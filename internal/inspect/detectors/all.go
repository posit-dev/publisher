package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type ContentTypeDetector struct {
	log       logging.Logger
	detectors []ContentTypeInferer
}

type ContentTypeDetectorFactory func(log logging.Logger) *ContentTypeDetector

func NewContentTypeDetector(log logging.Logger) *ContentTypeDetector {
	return &ContentTypeDetector{
		log: log,
		detectors: []ContentTypeInferer{
			// The order here is important, since the first
			// ContentTypeInferer to return a non-nil
			// ContentType will determine the result
			// for CLI `init`. For the UI, we show all of the
			// detected content types.
			NewPlumberDetector(log),
			NewRMarkdownDetector(log),
			NewNotebookDetector(),
			NewQuartoDetector(log),
			NewRShinyDetector(),
			NewPyShinyDetector(),
			NewFastAPIDetector(),
			NewFlaskDetector(),
			NewDashDetector(),
			NewGradioDetector(),
			NewPanelDetector(),
			NewStreamlitDetector(),
			NewBokehDetector(),
			NewStaticHTMLDetector(),
		},
	}
}

func newUnknownConfig() *config.Config {
	cfg := config.New()
	cfg.Type = contenttypes.ContentTypeUnknown
	return cfg
}

var preferredNames = []string{
	"index",
	"main",
	"app",
	"streamlit_app",
}

func filenameStem(filename string) string {
	ext := filepath.Ext(filename)
	return strings.TrimSuffix(filename, ext)
}

func (t *ContentTypeDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	allConfigs := []*config.Config{}

	_, err := base.Stat()
	if err != nil {
		return nil, err
	}

	for _, detector := range t.detectors {
		configs, err := detector.InferType(base, entrypoint)
		if err != nil {
			return nil, err
		}
		if configs != nil {
			allConfigs = append(allConfigs, configs...)
		}
	}
	if len(allConfigs) == 0 {
		allConfigs = append(allConfigs, newUnknownConfig())
	}

	compareConfigs := func(a, b *config.Config) int {
		entrypointA := a.Entrypoint
		entrypointB := b.Entrypoint
		stemA := filenameStem(entrypointA)
		stemB := filenameStem(entrypointB)

		aIsPreferred := base.Base() == stemA || slices.Contains(preferredNames, stemA)
		bIsPreferred := base.Base() == stemB || slices.Contains(preferredNames, stemB)

		if aIsPreferred && !bIsPreferred {
			return -1
		} else if !aIsPreferred && bIsPreferred {
			return 1
		} else {
			if entrypointA == entrypointB {
				return strings.Compare(string(a.Type), string(b.Type))
			} else {
				return strings.Compare(entrypointA, entrypointB)
			}
		}
	}

	slices.SortFunc(allConfigs, compareConfigs)
	return allConfigs, nil
}
