package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/util"
)

type PythonAppDetector struct {
	inferenceHelper
	appMode apptypes.AppMode
	imports []string
}

func NewPythonAppDetector(appMode apptypes.AppMode, imports []string) *PythonAppDetector {
	return &PythonAppDetector{
		inferenceHelper: defaultInferenceHelper{},
		appMode:         appMode,
		imports:         imports,
	}
}

func NewFlaskDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonAPIMode, []string{
		"flask", // also matches flask_api, flask_openapi3, etc.
		"flasgger",
		"falcon", // must check for this after falcon.asgi (FastAPI)
	})
}

func NewFastAPIDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonFastAPIMode, []string{
		"fastapi",
		"falcon.asgi",
		"quart",
		"sanic",
		"starlette",
		"vetiver",
	})
}

func NewDashDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonDashMode, []string{
		"dash", // also matches dash_core_components, dash_bio, etc.
	})
}

func NewStreamlitDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonStreamlitMode, []string{
		"streamlit",
	})
}

func NewBokehDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonBokehMode, []string{
		"bokeh",
	})
}

func NewPyShinyDetector() *PythonAppDetector {
	return NewPythonAppDetector(apptypes.PythonShinyMode, []string{
		"shiny",
	})
}

func (d *PythonAppDetector) InferType(path util.Path) (*ContentType, error) {
	entrypoint, entrypointPath, err := d.InferEntrypoint(path, ".py", "app.py")
	if err != nil {
		return nil, err
	}
	if entrypoint != "" {
		matches, err := d.FileHasPythonImports(entrypointPath, d.imports)
		if err != nil {
			return nil, err
		}
		if matches {
			return &ContentType{
				Entrypoint:     entrypoint,
				AppMode:        d.appMode,
				RequiresPython: true,
			}, nil
		}
		// else we didn't find a matching import
	}
	return nil, nil
}
