package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"compress/gzip"
	"connect-client/debug"
	"connect-client/util"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type bundle struct {
	manifest    *Manifest   // Manifest describing the bundle
	ignorer     Ignorer     // Ignore patterns from CLI and ignore files
	numFiles    int64       // Number of files in the bundle
	size        util.Size   // Total uncompressed size of the files, in bytes
	archive     *tar.Writer // Archive containing the files
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

var bundleTooLargeError = errors.New("Directory is too large to deploy.")

// writeHeaderToTar writes a file or directory entry to the tar archive.
func writeHeaderToTar(info fs.FileInfo, path string, archive *tar.Writer) error {
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
	writer := io.MultiWriter(archive, hash)
	_, err = io.Copy(writer, f)
	if err != nil {
		return nil, err
	}
	md5sum := hash.Sum(nil)
	return md5sum, nil
}

func (b *bundle) addFile(path string) error {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return err
	}
	err = b.addFileFunc(path, fileInfo, nil)
	if err != nil {
		return err
	}
	return nil
}

func (b *bundle) addFileFunc(path string, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return fmt.Errorf("Error creating bundle: %s", err)
	}
	pathLogger := b.logger.WithFields(rslog.Fields{
		"path": path,
		"size": info.Size(),
	})
	if info.IsDir() {
		// Load .rscignore from every directory where it exists
		ignorePath := filepath.Join(path, ".rscignore")
		err = b.ignorer.Append(ignorePath)
		if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("Error loading .rscignore file '%s': %s", ignorePath, err)
		}
		if isPythonEnvironmentDir(path) {
			pathLogger.Infof("Skipping Python environment directory")
			return filepath.SkipDir
		}
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
				err = b.ignorer.Walk(subPath, b.addFileFunc)
				if err != nil {
					return err
				}
			}
		} else {
			// Handle all non-directory symlink targets normally
			err = b.addFileFunc(path, targetInfo, nil)
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
	err := b.ignorer.Walk(dir, b.addFileFunc)
	if err != nil {
		return err
	}
	b.logger.WithFields(rslog.Fields{
		"files":       b.numFiles,
		"total_bytes": b.size.ToInt64(),
	}).Infof("Bundle created")
	return nil
}

func (b *bundle) addManifest() error {
	manifestJSON, err := json.MarshalIndent(b.manifest, "", "\t")
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

func NewBundleFromDirectory(dir string, ignores []string, dest io.Writer, logger rslog.Logger) error {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	logger.WithField("source_dir", absDir).Infof("Creating bundle from directory")
	ignorer, err := NewIgnorer(absDir, ignores)
	if err != nil {
		return fmt.Errorf("Error loading ignore list: %w", err)
	}
	gzipper := gzip.NewWriter(dest)
	defer gzipper.Close()

	archive := tar.NewWriter(gzipper)
	defer archive.Close()

	bundle := &bundle{
		manifest:    NewManifest(),
		ignorer:     ignorer,
		archive:     archive,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}
	oldWD, err := util.Chdir(dir)
	if err != nil {
		return err
	}
	defer util.Chdir(oldWD)

	err = bundle.addDirectory(absDir)
	if err != nil {
		return fmt.Errorf("Error creating bundle: %w", err)
	}
	bundle.manifest.Metadata.AppMode = "static" // TODO: pass this in
	err = bundle.addManifest()
	if err != nil {
		return err
	}
	return nil
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

	bundle := &bundle{
		manifest:    manifest,
		ignorer:     nil,
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
