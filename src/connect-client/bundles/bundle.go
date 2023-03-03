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

	"github.com/iriri/minimal/gitignore"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type Bundle struct {
	manifest    *Manifest             // Manifest describing the bundle
	ignoreList  *gitignore.IgnoreList // Ignore patterns from CLI and ignore files
	numFiles    int64                 // Number of files in the bundle
	size        util.Size             // Total uncompressed size of the files, in bytes
	archive     *tar.Writer           // Archive containing the files
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

var standardIgnores = []string{
	// From rsconnect-python
	".Rproj.user/",
	".env/",
	".git/",
	".svn/",
	".venv/",
	"__pycache__/",
	"env/",
	"packrat/",
	// rsconnect was more precise in specifying renv/renv.lock
	// "renv/",
	"rsconnect-python/",
	"rsconnect/",
	"venv/",

	// From rsconnect
	".DS_Store",
	".gitignore",
	".Rhistory",
	"manifest.json",
	// "rsconnect",
	// "packrat",
	"app_cache/",
	// ".svn/",
	// ".git/",
	".quarto/",
	// ".Rproj.user/",
	"renv/renv.lock",
	// Less precise than rsconnect, which checks for a
	// matching Rmd filename in the same directory.
	"*_cache/",
}

func loadIgnoreFiles(dir string, ignores []string) (*gitignore.IgnoreList, error) {
	var ignore gitignore.IgnoreList
	err := util.WithWorkingDir(dir, func() error {
		var err error
		ignore, err = gitignore.New()
		if err != nil {
			return err
		}
		const errNotInGitRepo = "not in a git repository"
		err = ignore.AppendGit()
		if err != nil && err.Error() != errNotInGitRepo {
			return err
		}
		for _, pattern := range standardIgnores {
			err = ignore.AppendGlob(pattern)
			if err != nil {
				return err
			}
		}
		for _, pattern := range ignores {
			err = ignore.AppendGlob(pattern)
			if err != nil {
				return err
			}
		}
		return err
	})
	return &ignore, err
}

var pythonBinPaths = []string{
	"bin/python",
	"bin/python3",
	"Scripts/python.exe",
	"Scripts/python3.exe",
}

func isPythonEnvironmentDir(path string) bool {
	for _, binary := range pythonBinPaths {
		if util.Exists(filepath.Join(path, binary)) {
			return true
		}
	}
	return false
}

var bundleTooLargeError = errors.New("Directory is too large to deploy.")

func writeToTar(info fs.FileInfo, path string, archive *tar.Writer) ([]byte, error) {
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return nil, fmt.Errorf("Error creating tarfile header for %s: %w", path, err)
	}
	header.Name = path
	if info.IsDir() {
		header.Name += "/"
	}
	err = archive.WriteHeader(header)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, nil
	}
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

func (bundle *Bundle) addFileFunc(path string, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return fmt.Errorf("Error creating bundle: %s", err)
	}
	pathLogger := bundle.logger.WithFields(rslog.Fields{
		"path": path,
		"size": info.Size(),
	})
	if info.IsDir() {
		// Load .rscignore from every directory where it exists
		ignorePath := filepath.Join(path, ".rscignore")
		err = bundle.ignoreList.Append(ignorePath)
		if err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("Error loading .rscignore file '%s': %s", ignorePath, err)
		}
		if isPythonEnvironmentDir(path) {
			pathLogger.Infof("Skipping Python environment directory")
			return filepath.SkipDir
		}
		_, err = writeToTar(info, path, bundle.archive)
		if err != nil {
			return err
		}
	} else if info.Mode().IsRegular() {
		pathLogger.Infof("Adding file")
		fileMD5, err := writeToTar(info, path, bundle.archive)
		if err != nil {
			return err
		}
		bundle.manifest.AddFile(path, fileMD5)
		bundle.numFiles++
		bundle.size += util.Size(info.Size())
	} else {
		pathLogger.Infof("Skipping non-regular file")
	}
	return nil
}

func (bundle *Bundle) addFiles(dir string) error {
	err := util.WithWorkingDir(dir, func() error {
		return bundle.ignoreList.Walk(dir, bundle.addFileFunc)
	})
	if err != nil {
		return err
	}
	bundle.logger.WithFields(rslog.Fields{
		"files":       bundle.numFiles,
		"total_bytes": bundle.size.ToInt64(),
	}).Infof("Bundle created")
	return nil
}

func (bundle *Bundle) addManifest() error {
	manifestJSON, err := json.MarshalIndent(bundle.manifest, "", "\t")
	if err != nil {
		return err
	}
	header := &tar.Header{
		Name: ManifestFilename,
		Size: int64(len(manifestJSON)),
		Mode: 0660,
	}
	err = bundle.archive.WriteHeader(header)
	if err != nil {
		return err
	}
	_, err = bundle.archive.Write(manifestJSON)
	return err
}

func NewBundleFromDirectory(dir string, ignores []string, dest io.Writer, logger rslog.Logger) error {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	logger.Infof("Creating bundle from directory at '%s'", absDir)
	ignoreList, err := loadIgnoreFiles(absDir, ignores)
	if err != nil {
		return fmt.Errorf("Error loading ignore list: %w", err)
	}
	gzipper := gzip.NewWriter(dest)
	defer gzipper.Close()

	archive := tar.NewWriter(gzipper)
	defer archive.Close()

	bundle := &Bundle{
		manifest:    NewManifest(),
		ignoreList:  ignoreList,
		archive:     archive,
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}
	err = bundle.addFiles(absDir)
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

// func NewBundleFromManifest(manifest *Manifest) *Bundle {
// 	bundle := NewBundle()
// 	for _, f := range manifest.Files {
// 	}
// 	return nil
// }
