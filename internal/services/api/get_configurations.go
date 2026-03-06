package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/types"
)

type configLocation struct {
	Name    string `json:"configurationName"`    // Config filename minus .toml
	Path    string `json:"configurationPath"`    // Full path to config file
	RelPath string `json:"configurationRelPath"` // Relative path to config file from the global base directory
}

type configDTO struct {
	configLocation
	ProjectDir    string            `json:"projectDir"` // Relative path to the project directory from the global base
	Configuration *config.Config    `json:"configuration,omitempty"`
	Error         *types.AgentError `json:"error,omitempty"`
}
