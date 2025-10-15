package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"fmt"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type PlumberDetector struct {
	inferenceHelper
	log      logging.Logger
	executor executor.Executor
}

type PlumberServerMetadata struct {
	Engine      string `yaml:"engine"`
	Routes      any    `yaml:"routes"` // string when single file or []string when multiple files
	Constructor string `yaml:"constructor"`
}

// rsconnect looks for these specific entrypointPath filenames and server files.
var possiblePlumberEntrypoints = []string{"plumber.r", "entrypoint.r"}
var possiblePlumberServerFiles = []string{"_server.yml", "_server.yaml"}

func NewPlumberDetector(log logging.Logger) *PlumberDetector {
	return &PlumberDetector{
		inferenceHelper: defaultInferenceHelper{},
		log:             log,
		executor:        executor.NewExecutor(),
	}
}

func (d *PlumberDetector) isSupportedEntrypoint(entrypoint util.RelativePath) bool {
	lcEntrypoint := strings.ToLower(entrypoint.String())
	return entrypoint.Ext() == ".R" || slices.Contains(possiblePlumberServerFiles, lcEntrypoint)
}

func (d *PlumberDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	requiredEntrypoint := entrypoint.String()
	if requiredEntrypoint != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if !d.isSupportedEntrypoint(entrypoint) {
			return nil, nil
		}
	}
	var configs []*config.Config

	// First try to infer by the existance of _server.y(a)ml file if it exists for plumber2 projects.
	configByServerfile, err := d.inferByServerFile(base, entrypoint)
	if err != nil {
		return nil, err
	}

	if configByServerfile != nil {
		configs = append(configs, configByServerfile)
		return configs, nil
	}

	// Next, try to infer by the existance of a traditional plumber API entrypoint file.
	configByEntrypoint, err := d.inferByEntrypoint(base, requiredEntrypoint)
	if err != nil {
		return nil, err
	}

	if configByEntrypoint != nil {
		configs = append(configs, configByEntrypoint)
		return configs, nil
	}

	return configs, nil
}

func (d *PlumberDetector) includeServerYmlFiles(cfg *config.Config, metadata PlumberServerMetadata) {
	if metadata.Constructor != "" {
		d.log.Info("Plumber project detection, including constructor file.", "constructor", metadata.Constructor)
		cfg.Files = append(cfg.Files, fmt.Sprint("/", metadata.Constructor))
	}

	routesString, ok := metadata.Routes.(string)
	if ok && routesString != "" {
		d.log.Info("Plumber project detection, including routes file.", "routes_file", routesString)
		cfg.Files = append(cfg.Files, fmt.Sprint("/", routesString))
	}

	routesList, ok := metadata.Routes.([]any)
	if ok && routesList != nil && len(routesList) > 0 {
		d.log.Info("Plumber project detection, routes is a list.")
		for _, routeFile := range routesList {
			routesFileString, ok := routeFile.(string)
			if ok && routesFileString != "" {
				d.log.Info("Plumber project detection, including routes file.", "routes_file", routesFileString)
				cfg.Files = append(cfg.Files, fmt.Sprint("/", routesFileString))
			}
		}
	}
}

func (d *PlumberDetector) inferByServerFile(base util.AbsolutePath, entrypoint util.RelativePath) (*config.Config, error) {
	serverFileChecker := NewPlumberServerFileChecker(d.log, base)
	serverFile, metadata := serverFileChecker.Find()

	if metadata == nil {
		// No server file found or could not be parsed.
		return nil, nil
	}

	// If there is metadata and engine is a version of "plumber", then we have a plumber project.
	if strings.Contains(metadata.Engine, "plumber") {
		d.log.Info("Plumber project detected by server file.", "server_file", serverFile, "engine", metadata.Engine)
		cfg := config.New()
		cfg.Type = contenttypes.ContentTypeRPlumber
		cfg.Entrypoint = entrypoint.String()

		// Include the server file in the list of files.
		cfg.Files = append(cfg.Files, fmt.Sprint("/", serverFile))

		// Indicate that R inspection is needed.
		cfg.R = &config.R{}
		d.includeServerYmlFiles(cfg, *metadata)
		return cfg, nil
	}

	return nil, nil
}

func (d *PlumberDetector) inferByEntrypoint(base util.AbsolutePath, requiredEntrypoint string) (*config.Config, error) {
	for _, relEntrypoint := range possiblePlumberEntrypoints {
		if relEntrypoint != strings.ToLower(requiredEntrypoint) {
			// Only inspect the specified file
			continue
		}
		entrypointPath := base.Join(requiredEntrypoint)
		exists, err := entrypointPath.Exists()
		if err != nil {
			return nil, err
		}
		if exists {
			cfg := config.New()
			cfg.Type = contenttypes.ContentTypeRPlumber
			cfg.Entrypoint = requiredEntrypoint

			// Include the entrypoint in the list of files.
			cfg.Files = append(cfg.Files, fmt.Sprint("/", requiredEntrypoint))

			// Indicate that R inspection is needed.
			cfg.R = &config.R{}
			return cfg, nil
		}
	}
	return nil, nil
}

type plumberServerFileChecker struct {
	log  logging.Logger
	base util.AbsolutePath
}

func NewPlumberServerFileChecker(log logging.Logger, base util.AbsolutePath) *plumberServerFileChecker {
	return &plumberServerFileChecker{
		log,
		base,
	}
}

func (p *plumberServerFileChecker) Find() (string, *PlumberServerMetadata) {
	for _, serverFile := range possiblePlumberServerFiles {
		// Does a server file exist?
		serverFilePath := p.base.Join(serverFile)
		exists, err := serverFilePath.Exists()
		if err != nil {
			p.log.Error("Error checking for existence of plumber server file, skipping.", "file", serverFilePath.String(), "error", err.Error())
			continue
		}
		if !exists {
			continue
		}

		// Read and parse the server file.
		content, err := serverFilePath.ReadFile()
		if err != nil {
			p.log.Error("Error reading plumber server file, skipping.", "file", serverFilePath.String(), "error", err.Error())
			continue
		}
		var metadata PlumberServerMetadata
		decoder := yaml.NewDecoder(bytes.NewReader(content))
		err = decoder.Decode(&metadata)
		if err != nil {
			p.log.Error("Error decoding YAML metadata for plumber server file, skipping.", "file", serverFilePath.String(), "error", err.Error())
			continue
		}
		return serverFile, &metadata
	}
	return "", nil
}
