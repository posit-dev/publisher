package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/util"
)

type PythonAppDetector struct {
	inferenceHelper
	contentType config.ContentType
	imports     []string
}

func NewPythonAppDetector(contentType config.ContentType, imports []string) *PythonAppDetector {
	return &PythonAppDetector{
		inferenceHelper: defaultInferenceHelper{},
		contentType:     contentType,
		imports:         imports,
	}
}

func NewFlaskDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonFlask, []string{
		"flask", // also matches flask_api, flask_openapi3, etc.
		"flasgger",
		"falcon", // must check for this after falcon.asgi (FastAPI)
		"bottle",
		"pycnic",
	})
}

func NewFastAPIDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonFastAPI, []string{
		"fastapi",
		"falcon.asgi",
		"quart",
		"sanic",
		"starlette",
		"vetiver",
	})
}

func NewDashDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonDash, []string{
		"dash", // also matches dash_core_components, dash_bio, etc.
	})
}

func NewStreamlitDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonStreamlit, []string{
		"streamlit",
	})
}

func NewBokehDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonBokeh, []string{
		"bokeh",
	})
}

func (d *PythonAppDetector) InferType(base util.AbsolutePath) ([]*config.Config, error) {
	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.py")

	if err != nil {
		return nil, err
	}
	if len(entrypointPaths) == 0 {
		// We didn't find a matching import
		return nil, nil
	}
	for _, entrypointPath := range entrypointPaths {
		matches, err := d.FileHasPythonImports(entrypointPath, d.imports)
		if err != nil {
			return nil, err
		}
		if matches {
			entrypoint, err := entrypointPath.Rel(base)
			if err != nil {
				return nil, err
			}
			cfg := config.New()
			cfg.Entrypoint = entrypoint.String()
			cfg.Type = d.contentType
			// indicate that Python inspection is needed
			cfg.Python = &config.Python{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
