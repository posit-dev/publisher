package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/util"
)

type PythonAppDetector struct {
	inferenceHelper
	contentType contenttypes.ContentType
	imports     []string
}

func NewPythonAppDetector(contentType contenttypes.ContentType, imports []string) *PythonAppDetector {
	return &PythonAppDetector{
		inferenceHelper: defaultInferenceHelper{},
		contentType:     contentType,
		imports:         imports,
	}
}

func NewFlaskDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonFlask, []string{
		"flask", // also matches flask_api, flask_openapi3, etc.
		"flasgger",
		"falcon", // must check for this after falcon.asgi (FastAPI)
		"bottle",
		"pycnic",
	})
}

func NewFastAPIDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonFastAPI, []string{
		"fastapi",
		"falcon.asgi",
		"quart",
		"sanic",
		"starlette",
		"vetiver",
	})
}

func NewDashDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonDash, []string{
		"dash", // also matches dash_core_components, dash_bio, etc.
	})
}

func NewGradioDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonGradio, []string{
		"gradio",
	})
}

func NewPanelDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonPanel, []string{
		"panel",
	})
}

func NewStreamlitDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonStreamlit, []string{
		"streamlit",
	})
}

func NewBokehDetector() *PythonAppDetector {
	return NewPythonAppDetector(contenttypes.ContentTypePythonBokeh, []string{
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
