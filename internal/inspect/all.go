package inspect

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

func (t *ContentTypeDetector) InferType(path util.Path) (*config.Config, error) {
	for _, detector := range t.detectors {
		cfg, err := detector.InferType(path)
		if err != nil {
			return nil, err
		}
		if cfg != nil {
			return cfg, nil
		}
	}
	cfg := config.New()
	cfg.Type = config.ContentTypeUnknown
	cfg.Entrypoint = "unknown"
	return cfg, nil
}

var _ ContentTypeInferer = &ContentTypeDetector{}
