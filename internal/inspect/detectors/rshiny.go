package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/util"
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

func (d *RShinyDetector) InferType(base util.AbsolutePath) ([]*config.Config, error) {
	// rsconnect looks for these two specific entrypoint filenames.
	// Note that server.R might contain server code referenced from a shiny-document.
	possibleEntrypoints := []string{"app.R", "server.R"}
	var configs []*config.Config

	for _, entrypoint := range possibleEntrypoints {
		entrypointPath := base.Join(entrypoint)
		exists, err := entrypointPath.Exists()
		if err != nil {
			return nil, err
		}
		if exists {
			cfg := config.New()
			cfg.Type = config.ContentTypeRShiny
			cfg.Entrypoint = entrypoint

			// Indicate that R inspection is needed.
			cfg.R = &config.R{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
