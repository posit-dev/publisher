package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/util"
)

type RShinyDetector struct {
	inferenceHelper
	executor executor.Executor
}

func NewRShinyDetector() *RShinyDetector {
	return &RShinyDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        executor.NewExecutor(),
	}
}

func (d *RShinyDetector) InferType(base util.AbsolutePath) (*config.Config, error) {
	// rsconnect looks for these two specific entrypoint filenames.
	// Note that this has to happen after rmd-shiny and quarto-shiny detection,
	// since server.R might contain server code referenced from a shiny-document.
	entrypoint := base.Join("app.R")
	exists, err := entrypoint.Exists()
	if err != nil {
		return nil, err
	}
	if !exists {
		entrypoint = base.Join("server.R")
		exists, err = entrypoint.Exists()
		if err != nil {
			return nil, err
		}
		if !exists {
			// Not a Shiny project
			return nil, nil
		}
	}

	cfg := config.New()
	cfg.Type = config.ContentTypeRShiny
	relPath, err := entrypoint.Rel(base)
	if err != nil {
		return nil, err
	}
	cfg.Entrypoint = relPath.String()

	// Indicate that R inspection is needed.
	cfg.R = &config.R{}
	return cfg, nil
}
