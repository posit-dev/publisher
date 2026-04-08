package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"

	"gopkg.in/yaml.v3"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type PlumberServerMetadata struct {
	Engine      string `yaml:"engine"`
	Routes      any    `yaml:"routes"` // string when single file or []string when multiple files
	Constructor string `yaml:"constructor"`
}

// rsconnect looks for these specific server files.
var possiblePlumberServerFiles = []string{"_server.yml", "_server.yaml"}

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
