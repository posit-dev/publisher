package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/rstudio/connect-client/internal/util"
)

type defaultInferenceHelper struct{}

// inferEntrypoint looks for an entrypoint for the provided path.
// If path is a file, it must end with the specified suffix to be the entrypoint.
// If it's a directory, it specifies the deployment directory.
// - If preferredFilename exists in the directory, it is the entrypoint.
// - If there is only one file with the specified suffix, it is the entrypoint.
func (h defaultInferenceHelper) InferEntrypoint(path util.Path, suffix string, preferredFilenames ...string) (string, util.Path, error) {
	isDir, err := path.IsDir()
	if err != nil {
		return "", util.Path{}, err
	}
	if isDir {
		matchingFiles, err := path.Glob("*" + suffix)
		if err != nil {
			return "", util.Path{}, err
		}
		if len(matchingFiles) == 0 {
			return "", util.Path{}, nil
		} else if len(matchingFiles) == 1 {
			// This must be it
			relPath, err := matchingFiles[0].Rel(path)
			return relPath.Path(), matchingFiles[0], err
		} else {
			for _, preferredFilename := range preferredFilenames {
				// Favor one of the preferredFilenames as an entrypoint
				preferredPath := path.Join(preferredFilename)
				exists, err := preferredPath.Exists()
				if err != nil {
					return "", util.Path{}, err
				}
				if exists {
					return preferredFilename, preferredPath, nil
				}
			}
			// else entrypoint is ambiguous.
			// Return the first one.
			relPath, err := matchingFiles[0].Rel(path)
			return relPath.Path(), matchingFiles[0], err
		}
	} else {
		fileSuffix := strings.ToLower(path.Ext())
		if fileSuffix == suffix {
			return path.Base(), path, nil
		}
	}
	return "", util.Path{}, nil
}

func (h defaultInferenceHelper) FileHasPythonImports(path util.Path, packages []string) (bool, error) {
	f, err := path.Open()
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
