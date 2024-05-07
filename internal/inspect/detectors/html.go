package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
)

type StaticHTMLDetector struct {
	inferenceHelper
}

func NewStaticHTMLDetector() *StaticHTMLDetector {
	return &StaticHTMLDetector{
		defaultInferenceHelper{},
	}
}

func (d *StaticHTMLDetector) InferType(base util.AbsolutePath) ([]*config.Config, error) {
	configs := []*config.Config{}
	entrypointPaths, err := base.Glob("*.html")
	if err != nil {
		return nil, err
	}
	moreEntrypointPaths, err := base.Glob("*.htm")
	if err != nil {
		return nil, err
	}
	entrypointPaths = append(entrypointPaths, moreEntrypointPaths...)
	if len(entrypointPaths) == 0 {
		return nil, nil
	}
	for _, entrypointPath := range entrypointPaths {
		entrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		cfg := config.New()
		cfg.Type = config.ContentTypeHTML
		cfg.Entrypoint = entrypoint.String()
		configs = append(configs, cfg)
	}
	return configs, nil
}
