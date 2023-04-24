package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"compress/gzip"
	"crypto/md5"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/util"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type Bundler interface {
	CreateManifest() (*Manifest, error)
	CreateBundle(archive io.Writer) error
}

// NewBundler creates a bundler that will archive the directory specified
// by `path`, or the containing directory if `path` is a file.
// The provided manifest should contain the metadata for the app,
// such as the entrypoint, Python version, R package dependencies, etc.
// The bundler will fill in the `files` section and include the manifest.json
// in the bundler.
func NewBundler(fs afero.Fs, path string, manifest *Manifest, ignores []string, logger rslog.Logger) (*bundler, error) {
	var dir string
	var filename string
	isDir, err := afero.IsDir(fs, path)
	if err != nil {
		return nil, err
	}
	if isDir {
		dir = path
		filename = ""
	} else {
		dir = filepath.Dir(path)
		filename = filepath.Base(path)
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	walker, err := NewWalker(fs, dir, ignores)
	if err != nil {
		return nil, fmt.Errorf("Error loading ignore list: %w", err)
	}
	return &bundler{
		manifest:    manifest,
		fs:          fs,
		baseDir:     absDir,
		filename:    filename,
		walker:      walker,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}, nil
}

func NewBundlerForManifest(fs afero.Fs, manifestPath string, logger rslog.Logger) (*bundler, error) {
	dir := filepath.Dir(manifestPath)
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	manifest, err := ReadManifestFile(fs, manifestPath)
	if err != nil {
		return nil, err
	}
	return &bundler{
		manifest:    manifest,
		fs:          fs,
		baseDir:     absDir,
		filename:    "",
		walker:      newManifestWalker(fs, absDir, manifest),
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}, nil
}

type bundler struct {
	fs          afero.Fs  // Filesystem we are walking to get the files
	baseDir     string    // Directory being bundled
	filename    string    // Primary file being deployed
	walker      Walker    // Ignore patterns from CLI and ignore files
	manifest    *Manifest // Manifest describing the bundle, if provided
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

type bundle struct {
	*bundler
	manifest *Manifest      // Manifest describing the bundle
	archive  util.TarWriter // Archive containing the files
	numFiles int64          // Number of files in the bundle
	size     util.Size      // Total uncompressed size of the files, in bytes
}

var bundleTooLargeError = errors.New("Directory is too large to deploy.")

func (b *bundler) CreateManifest() (*Manifest, error) {
	b.logger.WithField("source_dir", b.baseDir).Infof("Creating manifest from directory")
	return b.makeBundle(nil)
}

func (b *bundler) CreateBundle(archive io.Writer) (*Manifest, error) {
	b.logger.WithField("source_dir", b.baseDir).Infof("Creating bundle from directory")
	return b.makeBundle(archive)
}

func (b *bundler) makeBundle(dest io.Writer) (*Manifest, error) {
	bundle := &bundle{
		bundler: b,
	}
	if b.manifest != nil {
		manifestCopy, err := b.manifest.Clone()
		if err != nil {
			return nil, err
		}
		bundle.manifest = manifestCopy
	}
	if dest != nil {
		gzipper := gzip.NewWriter(dest)
		defer gzipper.Close()

		bundle.archive = tar.NewWriter(gzipper)
		defer bundle.archive.Close()
	}

	oldWD, err := util.Chdir(b.baseDir)
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	err = bundle.addDirectory(b.baseDir)
	if err != nil {
		return nil, fmt.Errorf("Error creating bundle: %w", err)
	}
	if b.filename != "" {
		// Ensure that the main file was not excluded
		_, ok := bundle.manifest.Files[b.filename]
		if !ok {
			path := filepath.Join(b.baseDir, b.filename)
			info, err := b.fs.Stat(path)
			if err != nil {
				return nil, err
			}
			err = bundle.walkFunc(path, info, nil)
			if err != nil {
				return nil, err
			}
		}
	}
	if dest != nil {
		if bundle.manifest.Python != nil {
			// If there isn't a requirements.txt file in the directory,
			// bundle the package list from the manifest as requirements.txt.
			_, haveRequirementsTxt := bundle.manifest.Files[PythonRequirementsFilename]
			if !haveRequirementsTxt {
				packages := bundle.manifest.Python.PackageManager.Packages
				err = bundle.addFile(PythonRequirementsFilename, packages)
				if err != nil {
					return nil, err
				}
			}
		}
		err = bundle.addManifest()
		if err != nil {
			return nil, err
		}
	}
	b.logger.WithFields(rslog.Fields{
		"files":       bundle.numFiles,
		"total_bytes": bundle.size.ToInt64(),
	}).Infof("Bundle created")
	return bundle.manifest, nil
}

// writeHeaderToTar writes a file or directory entry to the tar archive.
func writeHeaderToTar(info fs.FileInfo, path string, archive util.TarWriter) error {
	if archive == nil {
		// Just scanning files, not archiving
		return nil
	}
	if path == "." {
		// omit root dir
		return nil
	}
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return fmt.Errorf("Error creating tarfile header for %s: %w", path, err)
	}
	header.Name = path
	if info.IsDir() {
		header.Name += "/"
	}
	err = archive.WriteHeader(header)
	if err != nil {
		return err
	}
	return nil
}

// writeFileContentsToTar writes the contents of the specified file to the archive.
// It returns the file's md5 hash.
func writeFileContentsToTar(fs afero.Fs, path string, archive io.Writer) ([]byte, error) {
	f, err := fs.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	hash := md5.New()

	var dest io.Writer = hash
	if archive != nil {
		dest = io.MultiWriter(archive, hash)
	}
	_, err = io.Copy(dest, f)
	if err != nil {
		return nil, err
	}
	md5sum := hash.Sum(nil)
	return md5sum, nil
}

func (b *bundle) walkFunc(path string, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return err
	}
	relPath, err := filepath.Rel(b.baseDir, path)
	if err != nil {
		return err
	}
	pathLogger := b.logger.WithFields(rslog.Fields{
		"path": path,
		"size": info.Size(),
	})
	if info.IsDir() {
		err = writeHeaderToTar(info, relPath, b.archive)
		if err != nil {
			return err
		}
	} else if info.Mode().IsRegular() {
		pathLogger.Infof("Adding file")
		err = writeHeaderToTar(info, relPath, b.archive)
		if err != nil {
			return err
		}
		fileMD5, err := writeFileContentsToTar(b.fs, path, b.archive)
		if err != nil {
			return err
		}
		b.manifest.AddFile(relPath, fileMD5)
		b.numFiles++
		b.size += util.Size(info.Size())
	} else if info.Mode().Type()&os.ModeSymlink == os.ModeSymlink {
		pathLogger.Infof("Following symlink")
		targetPath, err := filepath.EvalSymlinks(path)
		if err != nil {
			return fmt.Errorf("Error following symlink %s: %w", path, err)
		}
		targetInfo, err := b.fs.Stat(targetPath)
		if err != nil {
			return fmt.Errorf("Error getting target info for symlink %s: %w", targetPath, err)
		}
		if targetInfo.IsDir() {
			dirEntries, err := afero.ReadDir(b.fs, targetPath)
			if err != nil {
				return err
			}
			// Iterate over the directory entries here, constructing
			// a path that goes through the symlink rather than
			// resolving the link and iterating the directory,
			// so that it appears as a descendant of the ignore list root dir.
			for _, entry := range dirEntries {
				subPath := filepath.Join(path, entry.Name())
				err = b.walker.Walk(subPath, b.walkFunc)
				if err != nil {
					return err
				}
			}
		} else {
			// Handle all non-directory symlink targets normally
			err = b.walkFunc(path, targetInfo, nil)
			if err != nil {
				return err
			}
		}
	} else {
		pathLogger.Warnf("Skipping non-regular file")
	}
	return nil
}

func (b *bundle) addDirectory(dir string) error {
	err := b.walker.Walk(dir, b.walkFunc)
	if err != nil {
		return err
	}
	return nil
}

func (b *bundle) addFile(name string, content []byte) error {
	header := &tar.Header{
		Name: name,
		Size: int64(len(content)),
		Mode: 0666,
	}
	err := b.archive.WriteHeader(header)
	if err != nil {
		return err
	}
	_, err = b.archive.Write(content)
	return err

}

func (b *bundle) addManifest() error {
	manifestJSON, err := b.manifest.ToJSON()
	if err != nil {
		return err
	}
	return b.addFile(ManifestFilename, manifestJSON)
}

type manifestWalker struct {
	fs       afero.Fs
	baseDir  string
	manifest *Manifest
}

func newManifestWalker(fs afero.Fs, baseDir string, manifest *Manifest) *manifestWalker {
	return &manifestWalker{
		fs:       fs,
		baseDir:  baseDir,
		manifest: manifest,
	}
}

// Walk is an implementation of the Walker interface that traverses
// only the files listed in the manifest Files section.
// Walk Chdir's into the provided base directory since
// manifest file paths are relative.
func (w *manifestWalker) Walk(_ string, fn filepath.WalkFunc) error {
	oldWD, err := util.Chdir(w.baseDir)
	if err != nil {
		return err
	}
	defer util.Chdir(oldWD)

	// Copy file map since it may be (is) modified during traversal.
	files := make(FileMap, len(w.manifest.Files))
	for k, v := range w.manifest.Files {
		files[k] = v
	}
	for path := range files {
		absPath, err := filepath.Abs(path)
		var fileInfo fs.FileInfo
		if err == nil {
			fileInfo, err = w.fs.Stat(absPath)
		}
		err = fn(absPath, fileInfo, err)
		if err != nil {
			return fmt.Errorf("Error adding file '%s' to the bundle: %w", path, err)
		}
	}
	return nil
}
