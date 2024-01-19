package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
)

// ContentTypeInferer infers as much as possible about the
// provided content. If inference is succcessful, InferType
// returns a partially filled Config. If it's not successful, it returns
// (nil, nil), i.e. failing inference is not an error.
// If there's an error during inferences, it returns (nil, err).
type ContentTypeInferer interface {
	InferType(path util.Path) (*config.Config, error)
}

type inferenceHelper interface {
	InferEntrypoint(path util.Path, suffix string, preferredFilenames ...string) (string, util.Path, error)
	HasPythonImports(r io.Reader, packages []string) (bool, error)
	FileHasPythonImports(path util.Path, packages []string) (bool, error)
}
