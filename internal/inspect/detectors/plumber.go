package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/util"
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

func (d *PlumberDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	requiredEntrypoint := entrypoint.String()
	if requiredEntrypoint != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if entrypoint.Ext() != ".R" {
			return nil, nil
		}
	}
	var configs []*config.Config
	// rsconnect looks for these two specific entrypointPath filenames
	possibleEntrypoints := []string{"plumber.R", "entrypoint.R"}

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
			cfg.Type = config.ContentTypeRPlumber
			cfg.Entrypoint = relEntrypoint

			// Indicate that R inspection is needed.
			cfg.R = &config.R{}
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
