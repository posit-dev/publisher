package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
)

type defaultInferenceHelper struct{}

// inferEntrypoint looks for an entrypoint for the provided path.
// If path is a file, it must end with the specified suffix to be the entrypoint.
// If it's a directory, it specifies the deployment directory.
// - If preferredFilename exists in the directory, it is the entrypoint.
// - If there is only one file with the specified suffix, it is the entrypoint.
func (h defaultInferenceHelper) InferEntrypoint(fs afero.Fs, path string, suffix string, preferredFilename string) (string, error) {
	isDir, err := afero.IsDir(fs, path)
	if err != nil {
		return "", err
	}
	if isDir {
		matchingFiles, err := afero.Glob(fs, filepath.Join(path, "*"+suffix))
		if err != nil {
			return "", err
		}
		if len(matchingFiles) == 1 {
			// This must be it
			return matchingFiles[0], nil
		} else {
			// Favor preferredFilename as an entrypoint
			preferredPath := filepath.Join(path, preferredFilename)
			exists, err := afero.Exists(fs, preferredPath)
			if err != nil {
				return "", err
			}
			if exists {
				return preferredFilename, nil
			}
			// else entrypoint is ambiguous
			return "", nil
		}
	} else {
		fileSuffix := strings.ToLower(filepath.Ext(path))
		if fileSuffix == suffix {
			return filepath.Base(path), nil
		}
	}
	return "", nil
}
