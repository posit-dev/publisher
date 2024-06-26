package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type deploymentState string

const (
	deploymentStateNew      deploymentState = "new"
	deploymentStateDeployed deploymentState = "deployed"
	deploymentStateError    deploymentState = "error"
)

type deploymentLocation struct {
	State      deploymentState `json:"state"`
	Name       string          `json:"deploymentName"`
	Path       string          `json:"deploymentPath"`
	ProjectDir string          `json:"projectDir"` // Relative path to the project directory from the global base
}

type preDeploymentDTO struct {
	deploymentLocation
	Schema     string              `json:"schema"`
	ServerType accounts.ServerType `json:"serverType"`
	ServerURL  string              `json:"serverUrl"`
	SaveName   string              `json:"saveName"`
	CreatedAt  string              `json:"createdAt"`
	ConfigName string              `json:"configurationName,omitempty"`
	ConfigPath string              `json:"configurationPath,omitempty"`
	Error      *types.AgentError   `json:"deploymentError,omitempty"`
}

type fullDeploymentDTO struct {
	deploymentLocation
	deployment.Deployment
	ConfigPath string `json:"configurationPath"`
	SaveName   string `json:"saveName"`
}

type deploymentErrorDTO struct {
	deploymentLocation
	Error *types.AgentError `json:"error,omitempty"`
}

func getConfigPath(base util.AbsolutePath, configName string) util.AbsolutePath {
	if configName == "" {
		return util.AbsolutePath{}
	}
	return config.GetConfigPath(base, configName)
}

func deploymentAsDTO(d *deployment.Deployment, err error, projectDir util.AbsolutePath, relProjectDir util.RelativePath, path util.AbsolutePath) any {
	saveName := deployment.SaveNameFromPath(path)
	configPath := ""

	if err != nil {
		return &deploymentErrorDTO{
			deploymentLocation: deploymentLocation{
				State:      deploymentStateError,
				Name:       saveName,
				Path:       path.String(),
				ProjectDir: relProjectDir.String(),
			},
			Error: types.AsAgentError(err),
		}
	} else if d.ID != "" {
		if d.ConfigName != "" {
			configPath = getConfigPath(projectDir, d.ConfigName).String()
		}
		return &fullDeploymentDTO{
			deploymentLocation: deploymentLocation{
				State:      deploymentStateDeployed,
				Name:       saveName,
				Path:       path.String(),
				ProjectDir: relProjectDir.String(),
			},
			Deployment: *d,
			ConfigPath: configPath,
			SaveName:   saveName, // TODO: remove this duplicate (remove frontend references first)
		}
	} else {
		if d.ConfigName != "" {
			configPath = getConfigPath(projectDir, d.ConfigName).String()
		}
		return preDeploymentDTO{
			deploymentLocation: deploymentLocation{
				State:      deploymentStateNew,
				Name:       saveName,
				Path:       path.String(),
				ProjectDir: relProjectDir.String(),
			},
			Schema:     d.Schema,
			ServerType: d.ServerType,
			ServerURL:  d.ServerURL,
			SaveName:   saveName, // TODO: remove this duplicate (remove frontend references first)
			CreatedAt:  d.CreatedAt,
			ConfigName: d.ConfigName,
			ConfigPath: configPath,
			Error:      d.Error,
		}
	}
}
