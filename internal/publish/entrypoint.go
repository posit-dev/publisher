package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"

	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/spf13/afero"
)

func inferEntrypoint(fs afero.Fs, dir string, suffix string, preferredFilename string) (apitypes.NullString, error) {
	matchingFiles, err := afero.Glob(fs, filepath.Join(dir, suffix))
	if err != nil {
		return apitypes.NullString{}, err
	}
	if len(matchingFiles) == 1 {
		// This must be it
		path := filepath.Join(dir, matchingFiles[0])
		return apitypes.NewOptional(path), nil
	} else {
		preferredPath := filepath.Join(dir, preferredFilename)
		exists, err := afero.Exists(fs, preferredPath)
		if err != nil {
			return apitypes.NullString{}, err
		}
		if exists {
			// Favor preferredFilename as an entrypoint
			return apitypes.NewOptional(preferredPath), nil
		}
		// else entrypoint is ambiguous
		return apitypes.NullString{}, nil
	}
}
