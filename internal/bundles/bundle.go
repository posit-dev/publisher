package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/md5"
	"fmt"
	"io"
	"io/fs"

	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type Bundler interface {
	CreateManifest() (*Manifest, error)
	CreateBundle(archive io.Writer) (*Manifest, error)
}

// NewBundler creates a bundler that will archive the directory specified
// by `path`, or the containing directory if `path` is a file.
// The provided manifest should contain the metadata for the app,
// such as the entrypoint, Python version, R package dependencies, etc.
// The bundler will fill in the `files` section and include the manifest.json
// in the bundler.
func NewBundler(path util.Path, manifest *Manifest, ignores []string, pythonRequirements []byte, log logging.Logger) (*bundler, error) {
	var dir util.Path
	var filename string
	isDir, err := path.IsDir()
	if err != nil {
		return nil, err
	}
	if isDir {
		dir = path
		filename = ""
	} else {
		dir = path.Dir()
		filename = path.Base()
	}
	absDir, err := dir.Abs()
	if err != nil {
		return nil, err
	}
	excluder, err := gitignore.NewExcludingWalker(dir, ignores)
	if err != nil {
		return nil, fmt.Errorf("error loading ignore list: %w", err)
	}
	log = log.WithArgs(logging.LogKeyOp, events.PublishCreateBundleOp)
	symlinkWalker := util.NewSymlinkWalker(excluder, log)

	return &bundler{
		manifest:           manifest,
		baseDir:            absDir,
		filename:           filename,
		walker:             symlinkWalker,
		pythonRequirements: pythonRequirements,
		log:                log,
	}, nil
}

func NewBundlerForManifestFile(manifestPath util.Path, log logging.Logger) (*bundler, error) {
	dir := manifestPath.Dir()
	manifest, err := ReadManifestFile(manifestPath)
	if err != nil {
		return nil, err
	}
	return NewBundlerForManifest(dir, manifest, log)
}

func NewBundlerForManifest(dir util.Path, manifest *Manifest, log logging.Logger) (*bundler, error) {
	absDir, err := dir.Abs()
	if err != nil {
		return nil, err
	}
	log = log.WithArgs(logging.LogKeyOp, events.PublishCreateBundleOp)
	return &bundler{
		manifest: manifest,
		baseDir:  absDir,
		filename: "",
		walker:   newManifestWalker(absDir, manifest),
		log:      log,
	}, nil
}

type bundler struct {
	baseDir            util.Path   // Directory being bundled
	filename           string      // Primary file being deployed
	walker             util.Walker // Ignore patterns from CLI and ignore files
	pythonRequirements []byte      // Pacakges to write to requirements.txt if not already present
	manifest           *Manifest   // Manifest describing the bundle, if provided
	log                logging.Logger
}

type bundle struct {
	*bundler
	manifest *Manifest      // Manifest describing the bundle
	archive  util.TarWriter // Archive containing the files
	numFiles int64          // Number of files in the bundle
	size     int64          // Total uncompressed size of the files, in bytes
}

func (b *bundler) CreateManifest() (*Manifest, error) {
	b.log.Info("Creating manifest from directory", "source_dir", b.baseDir)
	return b.makeBundle(nil)
}

func (b *bundler) CreateBundle(archive io.Writer) (*Manifest, error) {
	b.log.Info("Creating bundle from directory", "source_dir", b.baseDir)
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

	oldWD, err := util.Chdir(b.baseDir.Path())
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	err = bundle.addDirectory(b.baseDir)
	if err != nil {
		return nil, fmt.Errorf("error creating bundle: %w", err)
	}
	if b.filename != "" {
		// Ensure that the main file was not excluded
		_, ok := bundle.manifest.Files[b.filename]
		if !ok {
			path := b.baseDir.Join(b.filename)
			info, err := path.Stat()
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
		if bundle.pythonRequirements != nil {
			// If there isn't a requirements.txt file in the directory,
			// bundle the package list as requirements.txt.
			_, haveRequirementsTxt := bundle.manifest.Files[PythonRequirementsFilename]
			if !haveRequirementsTxt {
				err = bundle.addFile(PythonRequirementsFilename, bundle.pythonRequirements)
				if err != nil {
					return nil, err
				}
			}
		}
		bundle.manifest.ResetEmptyFields()
		err = bundle.addManifest()
		if err != nil {
			return nil, err
		}
	}
	b.log.Info("Bundle created", "files", bundle.numFiles, "total_bytes", bundle.size)
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
		return fmt.Errorf("error creating tarfile header for %s: %w", path, err)
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
func writeFileContentsToTar(r io.Reader, archive io.Writer) ([]byte, error) {
	hash := md5.New()
	var dest io.Writer = hash
	if archive != nil {
		dest = io.MultiWriter(archive, hash)
	}
	_, err := io.Copy(dest, r)
	if err != nil {
		return nil, err
	}
	md5sum := hash.Sum(nil)
	return md5sum, nil
}

func (b *bundle) walkFunc(path util.Path, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return err
	}
	relPath, err := path.Rel(b.baseDir)
	if err != nil {
		return err
	}
	pathLogger := b.log.WithArgs(
		"path", path,
		"size", info.Size(),
	)
	if info.IsDir() {
		err = writeHeaderToTar(info, relPath.Path(), b.archive)
		if err != nil {
			return err
		}
	} else if info.Mode().IsRegular() {
		pathLogger.Info("Adding file")
		err = writeHeaderToTar(info, relPath.Path(), b.archive)
		if err != nil {
			return err
		}
		f, err := path.Open()
		if err != nil {
			return err
		}
		defer f.Close()
		fileMD5, err := writeFileContentsToTar(f, b.archive)
		if err != nil {
			return err
		}
		b.manifest.AddFile(relPath.Path(), fileMD5)
		b.numFiles++
		b.size += info.Size()
	} else {
		pathLogger.Warn("Skipping non-regular file")
	}
	return nil
}

func (b *bundle) addDirectory(dir util.Path) error {
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
	f := bytes.NewReader(content)
	fileMD5, err := writeFileContentsToTar(f, b.archive)
	if err != nil {
		return err
	}
	if name != ManifestFilename {
		b.manifest.AddFile(name, fileMD5)
	}
	return nil
}

func (b *bundle) addManifest() error {
	manifestJSON, err := b.manifest.ToJSON()
	if err != nil {
		return err
	}
	return b.addFile(ManifestFilename, manifestJSON)
}

type manifestWalker struct {
	baseDir  util.Path
	manifest *Manifest
}

func newManifestWalker(baseDir util.Path, manifest *Manifest) *manifestWalker {
	return &manifestWalker{
		baseDir:  baseDir,
		manifest: manifest,
	}
}

// Walk is an implementation of the Walker interface that traverses
// only the files listed in the manifest Files section.
// Walk Chdir's into the provided base directory since
// manifest file paths are relative.
func (w *manifestWalker) Walk(root util.Path, fn util.WalkFunc) error {
	oldWD, err := util.Chdir(w.baseDir.Path())
	if err != nil {
		return err
	}
	defer util.Chdir(oldWD)

	// Copy file map since it may be (is) modified during traversal.
	files := make(ManifestFileMap, len(w.manifest.Files))
	for k, v := range w.manifest.Files {
		files[k] = v
	}
	for manifestPath := range files {
		path := util.NewPath(manifestPath, root.Fs())
		absPath, err := path.Abs()
		var fileInfo fs.FileInfo
		if err == nil {
			fileInfo, err = absPath.Stat()
		}
		err = fn(absPath, fileInfo, err)
		if err != nil {
			return fmt.Errorf("error adding file '%s' to the bundle: %w", path, err)
		}
	}
	return nil
}
