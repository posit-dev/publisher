package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/util"
)

type NotebookDetector struct {
	inferenceHelper
}

func NewNotebookDetector() *NotebookDetector {
	return &NotebookDetector{
		defaultInferenceHelper{},
	}
}

var voilaImportNames = []string{
	"ipywidgets",
	// From the Voila example notebooks
	"bqplot",
	"ipympl",
	"ipyvolume",
	// Other widget packages from PyPI
	"ipyspeck",
	"ipywebgl",
	"ipywebrtc",
}

func (d *NotebookDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if entrypoint.Ext() != ".ipynb" {
			return nil, nil
		}
	}
	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.ipynb")
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
		code, err := pydeps.GetNotebookFileInputs(entrypointPath)
		if err != nil {
			return nil, err
		}
		isVoila, err := d.HasPythonImports(strings.NewReader(code), voilaImportNames)
		if err != nil {
			return nil, err
		}
		cfg := config.New()
		cfg.Type = config.ContentTypeHTML
		cfg.Entrypoint = relEntrypoint.String()
		if isVoila {
			cfg.Type = config.ContentTypeJupyterVoila
		} else {
			cfg.Type = config.ContentTypeJupyterNotebook
		}
		// indicate that Python inspection is needed
		cfg.Python = &config.Python{}
		configs = append(configs, cfg)
	}
	return configs, nil
}
