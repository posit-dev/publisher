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

func (d *RShinyDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	requiredEntrypoint := entrypoint.String()
	if requiredEntrypoint != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if entrypoint.Ext() != ".R" {
			return nil, nil
		}
	}
	// rsconnect looks for these two specific entrypoint filenames.
	// Note that server.R might contain server code referenced from a shiny-document.
	possibleEntrypoints := []string{"app.R", "server.R"}
	var configs []*config.Config

	for _, relEntrypoint := range possibleEntrypoints {
		if requiredEntrypoint != "" && relEntrypoint != requiredEntrypoint {
			// Only inspect the specified file
			continue
		}
		entrypointPath := base.Join(relEntrypoint)
		exists, err := entrypointPath.Exists()
		if err != nil {
			return nil, err
		}
		if exists {
			cfg := config.New()
			cfg.Type = config.ContentTypeRShiny
			cfg.Entrypoint = relEntrypoint

			// Indicate that R inspection is needed.
			cfg.R = &config.R{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
