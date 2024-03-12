package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
)

type ContentTypeDetector struct {
	detectors []ContentTypeInferer
}

func NewContentTypeDetector() *ContentTypeDetector {
	return &ContentTypeDetector{
		detectors: []ContentTypeInferer{
			// The order here is important, since the first
			// ContentTypeInferer to return a non-nil
			// ContentType will determine the result.
			NewQuartoDetector(),
			NewNotebookDetector(),
			NewPyShinyDetector(),
			NewFastAPIDetector(),
			NewFlaskDetector(),
			NewDashDetector(),
			NewStreamlitDetector(),
			NewBokehDetector(),
			NewStaticHTMLDetector(),
		},
	}
}

func newUnknownConfig() *config.Config {
	cfg := config.New()
	cfg.Type = config.ContentTypeUnknown
	cfg.Entrypoint = "unknown"
	return cfg
}

func (t *ContentTypeDetector) InferType(path util.AbsolutePath) (*config.Config, error) {
	for _, detector := range t.detectors {
		cfg, err := detector.InferType(path)
		if err != nil {
			return nil, err
		}
		if cfg != nil {
			return cfg, nil
		}
	}
	return newUnknownConfig(), nil
}

func (t *ContentTypeDetector) InferAll(path util.AbsolutePath) ([]*config.Config, error) {
	var configs []*config.Config

	for _, detector := range t.detectors {
		cfg, err := detector.InferType(path)
		if err != nil {
			return nil, err
		}
		if cfg != nil {
			configs = append(configs, cfg)
		}
	}
	if configs == nil {
		configs = append(configs, newUnknownConfig())
	}
	return configs, nil
}

var _ ContentTypeInferer = &ContentTypeDetector{}
