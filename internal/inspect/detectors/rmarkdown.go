package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type RMarkdownDetector struct {
	inferenceHelper
	resourceFinderFactory multiResourceFinderFactory
	executor              executor.Executor
	log                   logging.Logger
}

func NewRMarkdownDetector(log logging.Logger) *RMarkdownDetector {
	rfFactory := func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return NewMultiResourceFinder(log, base, filesFromConfig)
	}

	return &RMarkdownDetector{
		inferenceHelper:       defaultInferenceHelper{},
		resourceFinderFactory: rfFactory,
		executor:              executor.NewExecutor(),
		log:                   log,
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

func (d *RMarkdownDetector) isSite(base util.AbsolutePath) (bool, string) {
	for _, ymlFile := range util.KnownSiteYmlConfigFiles {
		exists, err := base.Join(ymlFile).Exists()
		if err == nil && exists {
			d.log.Debug("Site configuration file is present, project being considered as static site", "file", ymlFile)
			return true, ymlFile
		}
	}
	return false, ""
}

func (d *RMarkdownDetector) lookForSiteMetadata(base util.AbsolutePath) (*RMarkdownMetadata, string) {
	// Attempt to get site metadata looking up in common files
	possibleIndexFiles := []string{"index.Rmd", "index.rmd", "app.Rmd", "app.rmd"}
	for _, file := range possibleIndexFiles {
		fileAbsPath := base.Join(file)
		exists, err := fileAbsPath.Exists()
		if err != nil || !exists {
			continue
		}
		metadata, err := d.getRmdFileMetadata(fileAbsPath)
		if err != nil {
			continue
		}
		if metadata != nil {
			return metadata, file
		}
	}
	return nil, ""
}

func (d *RMarkdownDetector) findAndIncludeAssets(base util.AbsolutePath, cfg *config.Config) {
	findAndIncludeAssets(d.log, d.resourceFinderFactory, base, cfg, "RMarkdown")
}

func (d *RMarkdownDetector) configFromFileInspect(base util.AbsolutePath, entrypointPath util.AbsolutePath) (*config.Config, error) {
	relEntrypoint, err := entrypointPath.Rel(base)
	if err != nil {
		return nil, err
	}

	metadata, err := d.getRmdFileMetadata(entrypointPath)
	if err != nil {
		d.log.Warn("Failed to read RMarkdown metadata", "path", entrypointPath, "error", err)
		return nil, err
	}

	cfg := config.New()
	cfg.Entrypoint = relEntrypoint.String()

	if isShinyRmd(metadata) {
		cfg.Type = contenttypes.ContentTypeRMarkdownShiny
	} else {
		cfg.Type = contenttypes.ContentTypeRMarkdown
	}

	if isSite, siteConfigFile := d.isSite(base); isSite {
		var siteMetadata *RMarkdownMetadata
		var indexFile string
		cfg.Files = []string{fmt.Sprint("/", siteConfigFile)}

		if metadata == nil {
			siteMetadata, indexFile = d.lookForSiteMetadata(base)
			metadata = siteMetadata
		}

		if indexFile != "" {
			cfg.Files = append(cfg.Files, fmt.Sprint("/", indexFile))
		}
	}

	// Add the entrypoint to cfg.Files so the resource finder can scan it for assets.
	entrypointFile := fmt.Sprint("/", relEntrypoint.String())
	if !slices.Contains(cfg.Files, entrypointFile) {
		cfg.Files = append(cfg.Files, entrypointFile)
	}

	if metadata != nil {
		title := metadata.Title
		if title != "" {
			cfg.Title = title
		}

		if metadata.Params != nil {
			hasParams := true
			cfg.HasParameters = &hasParams
		}
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
	d.findAndIncludeAssets(base, cfg)
	return cfg, nil
}

func (d *RMarkdownDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	entrypointIsSiteConfig := slices.Contains(util.KnownSiteYmlConfigFiles, strings.ToLower(entrypoint.String()))

	// When the choosen entrypoint is a site configuration yml
	// generate a single configuration as a site project.
	if entrypointIsSiteConfig {
		d.log.Debug("A site configuration file was picked as entrypoint", "entrypoint", entrypoint.String())

		cfg, err := d.configFromFileInspect(base, base.Join(entrypoint.String()))
		if err != nil {
			return nil, err
		}

		if cfg != nil {
			return []*config.Config{cfg}, nil
		}
	}

	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if entrypoint.Ext() != ".Rmd" {
			return nil, nil
		}
	}

	var configs []*config.Config
	entrypointPaths, err := base.Glob("*.Rmd")
	if err != nil {
		return nil, err
	}
	for _, entrypointPath := range entrypointPaths {
		relEntrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		if entrypoint.String() != "" && relEntrypoint != entrypoint {
			// Only inspect the specified file
			continue
		}
		cfg, err := d.configFromFileInspect(base, entrypointPath)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}
