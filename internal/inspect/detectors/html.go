package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/util"
)

type StaticHTMLDetector struct {
	inferenceHelper
}

func NewStaticHTMLDetector() *StaticHTMLDetector {
	return &StaticHTMLDetector{
		defaultInferenceHelper{},
	}
}

func (d *StaticHTMLDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		suffix := entrypoint.Ext()
		if suffix != ".html" && suffix != ".htm" {
			return nil, nil
		}
	}
	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.html")
	if err != nil {
		return nil, err
	}
	moreEntrypointPaths, err := base.Glob("*.htm")
	if err != nil {
		return nil, err
	}
	entrypointPaths = append(entrypointPaths, moreEntrypointPaths...)
	for _, entrypointPath := range entrypointPaths {
		relEntrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		if entrypoint.String() != "" && relEntrypoint != entrypoint {
			// Only inspect the specified file
			continue
		}
		cfg := config.New()
		cfg.Type = config.ContentTypeHTML
		cfg.Entrypoint = relEntrypoint.String()
		cfg.Files = []string{
			relEntrypoint.String(),
		}
		extraDirs := []string{"_site", relEntrypoint.WithoutExt().String() + "_files"}
		for _, filename := range extraDirs {
			path := base.Join(filename)
			exists, err := path.Exists()
			if err != nil {
				return nil, err
			}
			if exists {
				cfg.Files = append(cfg.Files, filename)
			}
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}
