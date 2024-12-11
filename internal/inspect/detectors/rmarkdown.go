package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles/matcher"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
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

func prepSiteFilesAndDirs(base util.AbsolutePath, files []string) ([]string, error) {
	// Logic to ignore files highly based on existing logic at rsconnect
	// It is nice to keep these files out from the generated configuration
	// https://github.com/rstudio/rsconnect/blob/a7c93ba015dca20a1c1fba393475b0b1538d1573/R/bundleFiles.R#L172
	filteredResult := []string{}

	// StandardExclusions is also used when querying the configuration defined files.
	// Then it returns hard stops and disables such files from the project tree.
	// In this particular case, it also requires some extra exclusions,
	// since this list is used while generating the configuration,
	// it is desired to keep out these files at the beginning from the original generated configuration.
	exclusionsExt := append(matcher.StandardExclusions,
		"!.gitignore",
		"!.github/",
		"!renv/",
	)

	patterns := append(files, exclusionsExt...)
	matchList, err := matcher.NewMatchList(base, patterns)
	if err != nil {
		return filteredResult, err
	}

	for _, filename := range files {
		// Ignore temporary files
		if strings.HasPrefix(filename, "~") || strings.Contains(filename, "~$") {
			continue
		}

		m := matchList.Match(base.Join(filename))
		if m == nil || m.Exclude {
			continue
		}

		filteredResult = append(filteredResult, fmt.Sprint("/", filename))
	}

	return filteredResult, nil
}

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

func (d *RMarkdownDetector) isSite(base util.AbsolutePath) bool {
	for _, ymlFile := range util.KnownSiteYmlConfigFiles {
		exists, err := base.Join(ymlFile).Exists()
		if err == nil && exists {
			d.log.Debug("Site configuration file is present, project being considered as static site", "file", ymlFile)
			return true
		}
	}
	return false
}

func (d *RMarkdownDetector) lookForSiteMetadata(base util.AbsolutePath) *RMarkdownMetadata {
	// Attempt to get site metadata looking up in common entrypoint files
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
			return metadata
		}
	}
	return nil
}

func (d *RMarkdownDetector) configFromFileInspect(base util.AbsolutePath, entrypointPath util.AbsolutePath) (*config.Config, error) {
	relEntrypoint, err := entrypointPath.Rel(base)
	if err != nil {
		return nil, err
	}

	isSite := d.isSite(base)
	metadata, err := d.getRmdFileMetadata(entrypointPath)
	if err != nil {
		d.log.Warn("Failed to read RMarkdown metadata", "path", entrypointPath, "error", err)
		return nil, err
	}

	cfg := config.New()
	cfg.Entrypoint = relEntrypoint.String()

	if isShinyRmd(metadata) {
		cfg.Type = config.ContentTypeRMarkdownShiny
	} else {
		cfg.Type = config.ContentTypeRMarkdown
	}

	if isSite {
		metadata = d.lookForSiteMetadata(base)
		files, err := base.ReadDirNames()
		if err != nil {
			return nil, err
		}

		cfgfiles, err := prepSiteFilesAndDirs(base, files)
		if err != nil {
			return nil, err
		}

		cfg.Files = cfgfiles
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
