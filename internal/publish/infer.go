package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/spf13/afero"
)

type ContentType struct {
	AppMode        apptypes.AppMode
	Entrypoint     string
	RequiresR      bool
	RequiresPython bool
	RequiresQuarto bool
}

// ContentTypeInferer infers as much as possible about the
// provided content. If inference is succcessful, InferType
// returns the content type. If it's not successful, it returns
// (nil, nil), i.e. failing inference is not an error.
// If there's an error during inferences, it returns (nil, err).
type ContentTypeInferer interface {
	InferType(fs afero.Fs, path string) (*ContentType, error)
}

type inferenceHelper interface {
	InferEntrypoint(fs afero.Fs, path string, suffix string, preferredFilename string) (string, string, error)
	HasPythonImports(r io.Reader, packages []string) (bool, error)
	FileHasPythonImports(fs afero.Fs, path string, packages []string) (bool, error)
}
