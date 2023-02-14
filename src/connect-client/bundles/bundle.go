package bundles

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"connect-client/debug"
	"connect-client/util"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/iriri/minimal/gitignore"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type Bundle struct {
	manifest    Manifest              // Manifest describing the bundle
	ignoreList  *gitignore.IgnoreList // Ignore patterns from CLI and ignore files
	numFiles    int64                 // Number of files in the bundle
	size        Size                  // Total uncompressed size of the files, in bytes
	archive     tar.Writer            // Archive containing the files (TODO: gzip)
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

type Size int64

func (n Size) String() string {
	if n < 1e3 {
		return fmt.Sprintf("%d", n)
	} else if n < 1e6 {
		return fmt.Sprintf("%.1f KB", float64(n)/1e3)
	} else if n < 1e9 {
		return fmt.Sprintf("%.1f MB", float64(n)/1e6)
	} else if n < 1e12 {
		return fmt.Sprintf("%.1f GB", float64(n)/1e9)
	} else {
		return fmt.Sprintf("%.1f TB", float64(n)/1e12)
	}
}

func loadIgnoreFiles(dir string, ignores []string) (*gitignore.IgnoreList, error) {
	ignore, err := gitignore.New()
	if err != nil {
		return nil, err
	}
	const errNotInGitRepo = "not in a git repository"
	err = ignore.AppendGit()
	if err != nil && err.Error() != errNotInGitRepo {
		return nil, err
	}
	for _, pattern := range standardIgnores {
		err = ignore.AppendGlob(pattern)
		if err != nil {
			return nil, err
		}
	}
	for _, pattern := range ignores {
		err = ignore.AppendGlob(pattern)
		if err != nil {
			return nil, err
		}
	}
	return &ignore, nil
}

func isPythonEnvironmentDir(path string) bool {
	return util.Exists(filepath.Join(path, "bin", "python")) ||
		util.Exists(filepath.Join(path, "bin", "python3")) ||
		util.Exists(filepath.Join(path, "Scripts", "python.exe")) ||
		util.Exists(filepath.Join(path, "Scripts", "python3.exe"))
}

func (bundle *Bundle) addFileFunc(path string, info fs.FileInfo, err error) error {
	if err != nil {
		// Stop walking the tree on errors.
		return fmt.Errorf("Error creating bundle: %s", err)
	}
	pathLogger := bundle.logger.WithFields(rslog.Fields{
		"path": path,
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
	} else if info.Mode().IsRegular() {
		pathLogger.Infof("Added file")
		bundle.numFiles++
		bundle.size += Size(info.Size())
	} else {
		pathLogger.Infof("Skipping non-regular file")
	}
	return nil
}

func NewBundleFromDirectory(dir string, ignores []string, dest io.Writer, logger rslog.Logger) (*Bundle, error) {
	absDir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	logger.Infof("Creating bundle from directory at '%s'", absDir)
	ignoreList, err := loadIgnoreFiles(dir, ignores)
	if err != nil {
		return nil, err
	}
	bundle := &Bundle{
		ignoreList:  ignoreList,
		archive:     *tar.NewWriter(dest),
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.BundleRegion),
	}
	err = ignoreList.Walk(dir, bundle.addFileFunc)
	if err != nil {
		return nil, err
	}
	bundle.logger.Infof("Bundle size: %d files totaling %s", bundle.numFiles, bundle.size)
	return bundle, nil
}

// func NewBundleFromManifest(manifest *Manifest) *Bundle {
// 	bundle := NewBundle()
// 	for _, f := range manifest.Files {
// 	}
// 	return nil
// }
