package deployments

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/state"
)

type DeploymentsService interface {
	GetDeployment() *state.Deployment
	SetDeploymentFiles(files []string) *state.Deployment
	SetDeploymentTitle(title string) *state.Deployment
}

func CreateDeploymentsService(deployment *state.Deployment) DeploymentsService {
	return &deploymentsService{deployment: deployment}
}

type deploymentsService struct {
	deployment *state.Deployment
}

func (s deploymentsService) GetDeployment() *state.Deployment {
	return s.deployment
}

func (s deploymentsService) SetDeploymentFiles(files []string) *state.Deployment {
	mfm := bundles.NewManifestFileMap()
	for _, file := range files {
		// We'll save the file path, but leave reading the
		// file and calculating the hash until deployment time.
		mfm[file] = bundles.NewManifestFile()
	}

	// mutate the Manifest Files value
	s.deployment.Manifest.Files = mfm

	return s.deployment
}

func (s deploymentsService) SetDeploymentTitle(title string) *state.Deployment {
	s.deployment.Connect.Content.Title = title

	return s.deployment
}
