package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/inspect/dependencies/pydeps"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"gopkg.in/yaml.v3"
)

type RMarkdownDetector struct {
	inferenceHelper
	executor executor.Executor
	log      logging.Logger
}

func NewRMarkdownDetector(log logging.Logger) *RMarkdownDetector {
	return &RMarkdownDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        executor.NewExecutor(),
		log:             log,
	}
}

// Rmd metadata is a YAML block delimited by lines containing only ---
// (this pattern allows it to be followed by optional whitespace)
var rmdMetaRE = regexp.MustCompile(`(?s)^---\s*\n(.*\n)---\s*\n`)

type RMarkdownMetadata struct {
	// Only	the	fields we need are defined here
	Title   string         `yaml:"title"`
	Runtime string         `yaml:"runtime"`
	Params  map[string]any `yaml:"params"`
	Server  any            `yaml:"server"` // string or a map
}

func (d *RMarkdownDetector) getRmdMetadata(rmdContent string) (*RMarkdownMetadata, error) {
	m := rmdMetaRE.FindStringSubmatch(rmdContent)
	if len(m) < 2 {
		return nil, nil
	}
	var metadata RMarkdownMetadata
	decoder := yaml.NewDecoder(strings.NewReader(m[1]))
	err := decoder.Decode(&metadata)
	if err != nil {
		return nil, err
	}
	return &metadata, nil
}

func (d *RMarkdownDetector) getRmdFileMetadata(path util.AbsolutePath) (*RMarkdownMetadata, error) {
	content, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	return d.getRmdMetadata(string(content))
}

func isShinyRmd(metadata *RMarkdownMetadata) bool {
	if metadata == nil {
		return false
	}
	if strings.HasPrefix(metadata.Runtime, "shiny") {
		return true
	}
	serverString, ok := metadata.Server.(string)
	if ok && serverString == "shiny" {
		return true
	}
	serverMap, ok := metadata.Server.(map[string]any)
	if ok && serverMap["type"] == "shiny" {
		return true
	}
	return false
}

func (d *RMarkdownDetector) InferType(base util.AbsolutePath) ([]*config.Config, error) {
	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.Rmd")
	if err != nil {
		return nil, err
	}
	if len(entrypointPaths) == 0 {
		// Not an R Markdown project
		return nil, nil
	}
	for _, entrypointPath := range entrypointPaths {
		metadata, err := d.getRmdFileMetadata(entrypointPath)
		if err != nil {
			d.log.Warn("Failed to read RMarkdown metadata", "path", entrypointPath, "error", err)
			continue
		}
		entrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		cfg := config.New()
		cfg.Entrypoint = entrypoint.String()

		if isShinyRmd(metadata) {
			cfg.Type = config.ContentTypeRMarkdownShiny
		} else {
			cfg.Type = config.ContentTypeRMarkdown
		}

		if metadata != nil {
			title := metadata.Title
			if title != "" {
				cfg.Title = title
			}

			if metadata.Params != nil {
				cfg.HasParameters = true
			}
		}
		if cfg.Title == "" {
			cfg.Title = base.Base()
		}
		needsR, needsPython, err := pydeps.DetectMarkdownLanguages(base)
		if err != nil {
			return nil, err
		}
		if needsR {
			// Indicate that R inspection is needed.
			d.log.Info("RMarkdown: detected R code; configuration will include R")
			cfg.R = &config.R{}
		}
		if needsPython {
			// Indicate that Python inspection is needed.
			d.log.Info("RMarkdown: detected Python code; configuration will include Python")
			cfg.Python = &config.Python{}
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}
