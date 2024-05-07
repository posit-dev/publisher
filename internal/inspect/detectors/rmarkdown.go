package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
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

type RMarkdownMetadata map[string]any

func (d *RMarkdownDetector) getRmdMetadata(rmdContent string) (RMarkdownMetadata, error) {
	m := rmdMetaRE.FindStringSubmatch(rmdContent)
	if len(m) < 2 {
		return RMarkdownMetadata{}, nil
	}
	var metadata RMarkdownMetadata
	decoder := yaml.NewDecoder(strings.NewReader(m[1]))
	err := decoder.Decode(&metadata)
	if err != nil {
		return nil, err
	}
	return metadata, nil
}

func (d *RMarkdownDetector) getRmdFileMetadata(path util.AbsolutePath) (RMarkdownMetadata, error) {
	content, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	return d.getRmdMetadata(string(content))
}

func (d *RMarkdownDetector) InferType(base util.AbsolutePath) (*config.Config, error) {
	projectRmdName := base.Base() + ".Rmd"
	entrypoint, entrypointPath, err := d.InferEntrypoint(base, ".Rmd", "index.Rmd", projectRmdName)
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		// Not an R Markdown project
		return nil, nil
	}
	metadata, err := d.getRmdFileMetadata(entrypointPath)
	if err != nil {
		return nil, err
	}
	cfg := config.New()
	cfg.Type = config.ContentTypeRMarkdown
	cfg.Entrypoint = entrypoint

	title := metadata["title"]
	if title != nil {
		cfg.Title = fmt.Sprintf("%s", title)
	}

	params := metadata["params"]
	if params != nil {
		cfg.HasParameters = true
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
	return cfg, nil
}
