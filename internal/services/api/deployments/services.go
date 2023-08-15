package deployments

import (
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/state"
)

type IDeploymentsService interface {
	GetDeployment() *state.Deployment
	SetDeploymentFiles(files []string) *state.Deployment
}

func CreateDeploymentsService(deployment *state.Deployment) IDeploymentsService {
	return &DeploymentsService{deployment: deployment}
}

type DeploymentsService struct {
	deployment *state.Deployment
}

func (s DeploymentsService) GetDeployment() *state.Deployment {
	return s.deployment
}

func (s DeploymentsService) SetDeploymentFiles(files []string) *state.Deployment {
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
