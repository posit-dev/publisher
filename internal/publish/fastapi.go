package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/publish/apptypes"
	"github.com/spf13/afero"
)

type FastAPIDetector struct {
	inferenceHelper
}

func NewFastAPIDetector() *FastAPIDetector {
	return &FastAPIDetector{
		defaultInferenceHelper{},
	}
}

var fastapiImportNames = []string{
	"fastapi",
	"quart",
	"sanic",
	"starlette",
	"vetiver",
}

func (d *FastAPIDetector) InferType(fs afero.Fs, path string) (*ContentType, error) {
	entrypoint, entrypointPath, err := d.InferEntrypoint(fs, path, ".py", "app.py")
	if err != nil {
		return nil, err
	}
	if entrypoint != "" {
		isFastAPI, err := d.FileHasPythonImports(fs, entrypointPath, fastapiImportNames)
		if err != nil {
			return nil, err
		}
		if isFastAPI {
			return &ContentType{
				Entrypoint: entrypoint,
				AppMode:    apptypes.PythonFastAPIMode,
				Runtimes:   []Runtime{PythonRuntime},
			}, nil
		}
		// else we didn't find a FastAPI import
	}
	return nil, nil
}
