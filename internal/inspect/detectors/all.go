package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"slices"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type ContentTypeDetector struct {
	detectors []ContentTypeInferer
}

func NewContentTypeDetector(log logging.Logger) *ContentTypeDetector {
	return &ContentTypeDetector{
		detectors: []ContentTypeInferer{
			// The order here is important, since the first
			// ContentTypeInferer to return a non-nil
			// ContentType will determine the result.
			NewPlumberDetector(),
			NewQuartoDetector(),
			NewRMarkdownDetector(log),
			NewNotebookDetector(),
			NewRShinyDetector(),
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
	return cfg
}

var preferredNames = []string{
	"index",
	"main",
	"app",
	"streamlit_app",
}

func compareConfigs(a, b *config.Config) int {
	entrypointA := a.Entrypoint
	entrypointB := b.Entrypoint
	aIsPreferred := slices.Contains(preferredNames, entrypointA)
	bIsPreferred := slices.Contains(preferredNames, entrypointB)
	if aIsPreferred && !bIsPreferred {
		return -1
	} else if !aIsPreferred && bIsPreferred {
		return 1
	} else {
		return strings.Compare(entrypointA, entrypointB)
	}
}

func (t *ContentTypeDetector) InferType(path util.AbsolutePath) ([]*config.Config, error) {
	var allConfigs []*config.Config

	for _, detector := range t.detectors {
		configs, err := detector.InferType(path)
		if err != nil {
			return nil, err
		}
		if configs != nil {
			allConfigs = append(allConfigs, configs...)
		}
	}
	if allConfigs == nil {
		allConfigs = append(allConfigs, newUnknownConfig())
	}
	slices.SortFunc(allConfigs, compareConfigs)
	return allConfigs, nil
}

var _ ContentTypeInferer = &ContentTypeDetector{}
