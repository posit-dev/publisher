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
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
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
func NewBundler(path util.AbsolutePath, manifest *Manifest, filePatterns []string, log logging.Logger) (*bundler, error) {
	var dir util.AbsolutePath
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
	if len(filePatterns) == 0 {
		log.Info("No file patterns specified; using default pattern '*'")
		filePatterns = []string{"*"}
	}
	matcher, err := matcher.NewMatchingWalker(filePatterns, dir, log)
	if err != nil {
		return nil, err
	}

	log = log.WithArgs(logging.LogKeyOp, events.PublishCreateBundleOp)
	symlinkWalker := util.NewSymlinkWalker(matcher, log)

	return &bundler{
		manifest: manifest,
		baseDir:  dir,
		filename: filename,
		walker:   symlinkWalker,
		log:      log,
	}, nil
}

type bundler struct {
	baseDir  util.AbsolutePath // Directory being bundled
	filename string            // Primary file being deployed
	walker   util.Walker       // Only walks files matching patterns from the configuration
	manifest *Manifest         // Manifest describing the bundle, if provided
	log      logging.Logger
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

	oldWD, err := util.Chdir(b.baseDir.String())
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

func (b *bundle) walkFunc(path util.AbsolutePath, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return err
	}
	relPath, err := path.Rel(b.baseDir)
	if err != nil {
		return err
	}
	pathLogger := b.log.WithArgs(
		"path", relPath,
		"size", info.Size(),
	)
	if info.IsDir() {
		// Manifest filenames are always Posix paths, not Windows paths
		err = writeHeaderToTar(info, relPath.ToSlash(), b.archive)
		if err != nil {
			return err
		}
	} else if info.Mode().IsRegular() {
		pathLogger.Debug("Adding file")
		// Manifest filenames are always Posix paths, not Windows paths
		err = writeHeaderToTar(info, relPath.ToSlash(), b.archive)
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
		b.manifest.AddFile(relPath.ToSlash(), fileMD5)
		b.numFiles++
		b.size += info.Size()
	} else {
		pathLogger.Warn("Skipping non-regular file")
	}
	return nil
}

func (b *bundle) addDirectory(dir util.AbsolutePath) error {
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
		b.manifest.AddFile(filepath.ToSlash(name), fileMD5)
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
