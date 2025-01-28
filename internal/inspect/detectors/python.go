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

func NewGradioDetector() *PythonAppDetector {
	return NewPythonAppDetector(config.ContentTypePythonGradio, []string{
		"gradio",
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

func (d *PythonAppDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if entrypoint.Ext() != ".py" {
			return nil, nil
		}
	}
	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.py")

	if err != nil {
		return nil, err
	}
	for _, entrypointPath := range entrypointPaths {
		relEntrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		if entrypoint.String() != "" && relEntrypoint != entrypoint {
			// Only inspect the specified file
			continue
		}
		matches, err := d.FileHasPythonImports(entrypointPath, d.imports)
		if err != nil {
			return nil, err
		}
		if matches {
			cfg := config.New()
			cfg.Entrypoint = relEntrypoint.String()
			cfg.Type = d.contentType
			// indicate that Python inspection is needed
			cfg.Python = &config.Python{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
