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
)

type bundler struct {
	manifest    *Manifest   // Manifest describing the bundle
	walker      Walker      // Ignore patterns from CLI and ignore files
	numFiles    int64       // Number of files in the bundle
	size        util.Size   // Total uncompressed size of the files, in bytes
	archive     *tar.Writer // Archive containing the files
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

var bundleTooLargeError = errors.New("Directory is too large to deploy.")

// writeHeaderToTar writes a file or directory entry to the tar archive.
func writeHeaderToTar(info fs.FileInfo, path string, archive *tar.Writer) error {
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
func writeFileContentsToTar(path string, archive *tar.Writer) ([]byte, error) {
	f, err := os.Open(path)
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

func (b *bundler) addFile(path string) error {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return err
	}
	err = b.walkFunc(path, fileInfo, nil)
	if err != nil {
		return err
	}
	return nil
}

func (b *bundler) walkFunc(path string, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return err
	}
	pathLogger := b.logger.WithFields(rslog.Fields{
		"path": path,
		"size": info.Size(),
	})
	if info.IsDir() {
		err = writeHeaderToTar(info, path, b.archive)
		if err != nil {
			return err
		}
	} else if info.Mode().IsRegular() {
		pathLogger.Infof("Adding file")
		err = writeHeaderToTar(info, path, b.archive)
		if err != nil {
			return err
		}
		fileMD5, err := writeFileContentsToTar(path, b.archive)
		if err != nil {
			return err
		}
		b.manifest.AddFile(path, fileMD5)
		b.numFiles++
		b.size += util.Size(info.Size())
	} else if info.Mode().Type()&os.ModeSymlink == os.ModeSymlink {
		pathLogger.Infof("Following symlink")
		targetPath, err := filepath.EvalSymlinks(path)
		if err != nil {
			return fmt.Errorf("Error following symlink %s: %w", path, err)
		}
		targetInfo, err := os.Stat(targetPath)
		if err != nil {
			return fmt.Errorf("Error getting target info for symlink %s: %w", targetPath, err)
		}
		if targetInfo.IsDir() {
			dirEntries, err := os.ReadDir(targetPath)
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

func (b *bundler) addDirectory(dir string) error {
	err := b.walker.Walk(dir, b.walkFunc)
	if err != nil {
		return err
	}
	b.logger.WithFields(rslog.Fields{
		"files":       b.numFiles,
		"total_bytes": b.size.ToInt64(),
	}).Infof("Bundle created")
	return nil
}

func (b *bundler) addManifest() error {
	manifestJSON, err := b.manifest.ToJSON()
	if err != nil {
		return err
	}
	header := &tar.Header{
		Name: ManifestFilename,
		Size: int64(len(manifestJSON)),
		Mode: 0660,
	}
	err = b.archive.WriteHeader(header)
	if err != nil {
		return err
	}
	_, err = b.archive.Write(manifestJSON)
	return err
}

func NewManifestFromDirectory(dir string, walker Walker, logger rslog.Logger) (*Manifest, error) {
	return NewBundleFromDirectory(dir, walker, nil, logger)
}

func NewBundleFromDirectory(dir string, walker Walker, dest io.Writer, logger rslog.Logger) (*Manifest, error) {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	logger.WithField("source_dir", absDir).Infof("Creating bundle from directory")

	var archive *tar.Writer
	if dest != nil {
		gzipper := gzip.NewWriter(dest)
		defer gzipper.Close()

		archive = tar.NewWriter(gzipper)
		defer archive.Close()
	}

	oldWD, err := util.Chdir(dir)
	if err != nil {
		return nil, err
	}
	defer util.Chdir(oldWD)

	bundle := &bundler{
		manifest:    NewManifest(),
		walker:      walker,
		archive:     archive,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}

	err = bundle.addDirectory(absDir)
	if err != nil {
		return nil, fmt.Errorf("Error creating bundle: %w", err)
	}
	bundle.manifest.Metadata.AppMode = "static" // TODO: pass this in
	if dest != nil {
		err = bundle.addManifest()
		if err != nil {
			return nil, err
		}
	}
	return bundle.manifest, nil
}

func NewBundleFromManifest(manifestPath string, dest io.Writer, logger rslog.Logger) error {
	manifest, err := ReadManifestFile(manifestPath)
	if err != nil {
		return err
	}
	dir := filepath.Dir(manifestPath)
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	logger.WithField("source_dir", absDir).Infof("Creating bundle from directory")

	gzipper := gzip.NewWriter(dest)
	defer gzipper.Close()

	archive := tar.NewWriter(gzipper)
	defer archive.Close()

	bundle := &bundler{
		manifest:    manifest,
		walker:      nil,
		archive:     archive,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}
	oldWD, err := util.Chdir(dir)
	if err != nil {
		return err
	}
	defer util.Chdir(oldWD)

	for path := range manifest.Files {
		err = bundle.addFile(path)
		if err != nil {
			return fmt.Errorf("Error adding file '%s' to the bundle: %w", path, err)
		}
	}
	err = bundle.addManifest()
	if err != nil {
		return fmt.Errorf("Error adding manifest to the bundle: %w", err)
	}
	return nil
}
