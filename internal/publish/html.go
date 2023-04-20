package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/publish/apptypes"
	"github.com/spf13/afero"
)

type StaticHTMLDetector struct {
	inferenceHelper
}

func NewStaticHTMLDetector() *StaticHTMLDetector {
	return &StaticHTMLDetector{
		defaultInferenceHelper{},
	}
}

func (d *StaticHTMLDetector) InferType(fs afero.Fs, path string) (*ContentType, error) {
	entrypoint, err := d.InferEntrypoint(fs, path, ".html", "index.html")
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		entrypoint, err = d.InferEntrypoint(fs, path, ".htm", "index.htm")
		if err != nil {
			return nil, err
		}
	}
	if entrypoint != "" {
		return &ContentType{
			appMode:    apptypes.StaticMode,
			entrypoint: entrypoint,
		}, nil
	}
	return nil, nil
}
