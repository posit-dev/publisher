package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/util"
)

type PlumberDetector struct {
	inferenceHelper
	executor executor.Executor
}

func NewPlumberDetector() *PlumberDetector {
	return &PlumberDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        executor.NewExecutor(),
	}
}

func (d *PlumberDetector) InferType(base util.AbsolutePath) ([]*config.Config, error) {
	var configs []*config.Config
	// rsconnect looks for these two specific entrypointPath filenames
	possibleEntrypoints := []string{"plumber.R", "entrypoint.R"}

	for _, entrypoint := range possibleEntrypoints {
		entrypointPath := base.Join(entrypoint)
		exists, err := entrypointPath.Exists()
		if err != nil {
			return nil, err
		}
		if exists {
			cfg := config.New()
			cfg.Type = config.ContentTypeRPlumber
			cfg.Entrypoint = entrypoint

			// Indicate that R inspection is needed.
			cfg.R = &config.R{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
