package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"

	"github.com/spf13/afero"
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

var errCantDetectContentType = errors.New("Could not automatically detect content type. Please specify it with the -t option.")

func (t *ContentTypeDetector) InferType(fs afero.Fs, path string) (*ContentType, error) {
	for _, detector := range t.detectors {
		contentType, err := detector.InferType(fs, path)
		if err != nil {
			return nil, err
		}
		if contentType != nil {
			return contentType, nil
		}
	}
	return nil, errCantDetectContentType
}

var _ ContentTypeInferer = &ContentTypeDetector{}
