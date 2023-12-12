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

func (t *ContentTypeDetector) InferType(path util.Path) (*ContentType, error) {
	for _, detector := range t.detectors {
		contentType, err := detector.InferType(path)
		if err != nil {
			return nil, err
		}
		if contentType != nil {
			return contentType, nil
		}
	}
	return &ContentType{
		Type:       config.ContentTypeUnknown,
		Entrypoint: "unknown",
	}, nil
}

var _ ContentTypeInferer = &ContentTypeDetector{}
