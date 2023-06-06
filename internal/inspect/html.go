package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/apptypes"
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

func (d *StaticHTMLDetector) InferType(path util.Path) (*ContentType, error) {
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
		return &ContentType{
			AppMode:    apptypes.StaticMode,
			Entrypoint: entrypoint,
		}, nil
	}
	return nil, nil
}
