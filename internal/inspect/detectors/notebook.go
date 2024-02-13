package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/inspect/dependencies/pydeps"
	"github.com/rstudio/connect-client/internal/util"
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

func (d *NotebookDetector) InferType(path util.Path) (*config.Config, error) {
	entrypoint, entrypointPath, err := d.InferEntrypoint(path, ".ipynb", "index.ipynb")
	if err != nil {
		return nil, err
	}
	if entrypoint != "" {
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
		cfg.Entrypoint = entrypoint
		if isVoila {
			cfg.Type = config.ContentTypeJupyterVoila
		} else {
			cfg.Type = config.ContentTypeJupyterNotebook
		}
		// indicate that Python inspection is needed
		cfg.Python = &config.Python{}
		return cfg, nil
	}
	return nil, nil
}
