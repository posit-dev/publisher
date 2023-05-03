package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/afero"
)

type defaultInferenceHelper struct{}

// inferEntrypoint looks for an entrypoint for the provided path.
// If path is a file, it must end with the specified suffix to be the entrypoint.
// If it's a directory, it specifies the deployment directory.
// - If preferredFilename exists in the directory, it is the entrypoint.
// - If there is only one file with the specified suffix, it is the entrypoint.
func (h defaultInferenceHelper) InferEntrypoint(fs afero.Fs, path string, suffix string, preferredFilename string) (string, string, error) {
	isDir, err := afero.IsDir(fs, path)
	if err != nil {
		return "", "", err
	}
	if isDir {
		matchingFiles, err := afero.Glob(fs, filepath.Join(path, "*"+suffix))
		if err != nil {
			return "", "", err
		}
		if len(matchingFiles) == 1 {
			// This must be it
			relPath, err := filepath.Rel(path, matchingFiles[0])
			return relPath, matchingFiles[0], err
		} else {
			// Favor preferredFilename as an entrypoint
			preferredPath := filepath.Join(path, preferredFilename)
			exists, err := afero.Exists(fs, preferredPath)
			if err != nil {
				return "", "", err
			}
			if exists {
				return preferredFilename, preferredPath, nil
			}
			// else entrypoint is ambiguous
			return "", "", nil
		}
	} else {
		fileSuffix := strings.ToLower(filepath.Ext(path))
		if fileSuffix == suffix {
			return filepath.Base(path), path, nil
		}
	}
	return "", "", nil
}

func (h defaultInferenceHelper) FileHasPythonImports(fs afero.Fs, path string, packages []string) (bool, error) {
	f, err := fs.Open(path)
	if err != nil {
		return false, err
	}
	defer f.Close()
	return h.HasPythonImports(f, packages)
}

func (h defaultInferenceHelper) HasPythonImports(r io.Reader, packages []string) (bool, error) {
	contents, err := io.ReadAll(r)
	if err != nil {
		return false, err
	}

	for _, pkg := range packages {
		packageRe := fmt.Sprintf("import %s|from %s.* import", pkg, pkg)
		matched, err := regexp.Match(packageRe, contents)
		if err != nil {
			return false, err
		}
		if matched {
			return true, nil
		}
	}
	return false, nil
}
