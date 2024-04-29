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

func (d *PlumberDetector) InferType(base util.AbsolutePath) (*config.Config, error) {
	// rsconnect looks for these two specific entrypoint filenames
	entrypoint := base.Join("plumber.R")
	exists, err := entrypoint.Exists()
	if err != nil {
		return nil, err
	}
	if !exists {
		entrypoint = base.Join("entrypoint.R")
		exists, err = entrypoint.Exists()
		if err != nil {
			return nil, err
		}
		if !exists {
			// Not a Plumber project
			return nil, nil
		}
	}

	cfg := config.New()
	cfg.Type = config.ContentTypeRPlumber
	relPath, err := entrypoint.Rel(base)
	if err != nil {
		return nil, err
	}
	cfg.Entrypoint = relPath.String()

	// Indicate that R inspection is needed.
	cfg.R = &config.R{}
	return cfg, nil
}
