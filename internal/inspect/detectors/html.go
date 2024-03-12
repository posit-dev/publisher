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

func (d *StaticHTMLDetector) InferType(path util.AbsolutePath) (*config.Config, error) {
	entrypoint, _, err := d.InferEntrypoint(path, ".html", "index.html")
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		entrypoint, _, err = d.InferEntrypoint(path, ".htm", "index.htm")
		if err != nil {
			return nil, err
		}
	}
	if entrypoint != "" {
		cfg := config.New()
		cfg.Type = config.ContentTypeHTML
		cfg.Entrypoint = entrypoint
		return cfg, nil
	}
	return nil, nil
}
