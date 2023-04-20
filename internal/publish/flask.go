package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/publish/apptypes"
	"github.com/spf13/afero"
)

type FlaskDetector struct {
	inferenceHelper
}

func NewFlaskDetector() *FlaskDetector {
	return &FlaskDetector{
		defaultInferenceHelper{},
	}
}

var flaskImportNames = []string{
	"flask", // also matches flask_api, flask_openapi3, etc.
	"flasgger",
}

func (d *FlaskDetector) InferType(fs afero.Fs, path string) (*ContentType, error) {
	entrypoint, err := d.InferEntrypoint(fs, path, ".py", "app.py")
	if err != nil {
		return nil, err
	}
	if entrypoint != "" {
		isFlask, err := d.FileHasPythonImports(fs, entrypoint, flaskImportNames)
		if err != nil {
			return nil, err
		}
		if isFlask {
			return &ContentType{
				entrypoint: entrypoint,
				appMode:    apptypes.PythonAPIMode,
				runtimes:   []Runtime{PythonRuntime},
			}, nil
		}
		// else we didn't find a Flask import
	}
	return nil, nil
}
