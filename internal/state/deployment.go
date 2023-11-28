package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"sort"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type OldConnectDeployment struct {
	Content ConnectContent `json:"content"`
}

type OldDeployment struct {
	LocalID            LocalDeploymentID    `json:"local_id"`            // Unique ID of this publishing operation. Only valid for this run of the agent.
	SourceDir          util.Path            `json:"source_path"`         // Absolute path to source directory being published
	Target             OldTargetID          `json:"target"`              // Identity of previous deployment
	Manifest           bundles.Manifest     `json:"manifest"`            // manifest.json content for this deployment
	Connect            OldConnectDeployment `json:"connect"`             // Connect metadata for this deployment, if target is Connect
	PythonRequirements []byte               `json:"python_requirements"` // Content of requirements.txt to include
}

func OldDeploymentFromState(s *State) *OldDeployment {
	d := OldDeploymentFromConfig(s.Dir, s.Config, s.Account, s.Target)
	d.LocalID = s.LocalID
	return d
}

func OldDeploymentFromConfig(path util.Path, cfg *config.Config, account *accounts.Account, target *deployment.Deployment) *OldDeployment {
	var contentID types.ContentID
	files := make(bundles.ManifestFileMap)

	if target != nil {
		contentID = target.Id
		for _, f := range target.Files {
			files[f] = bundles.ManifestFile{
				Checksum: "",
			}
		}
	}
	targetID := OldTargetID{
		ContentId: contentID,
	}
	if account != nil {
		targetID.ServerType = account.ServerType
		targetID.ServerURL = account.URL
	} else if target != nil {
		targetID.ServerType = target.ServerType
		targetID.ServerURL = target.ServerURL
	}
	m := bundles.NewManifestFromConfig(cfg)
	m.Files = files
	return &OldDeployment{
		SourceDir:          path,
		Target:             targetID,
		Manifest:           *m,
		Connect:            OldConnectDeployment{*ConnectContentFromConfig(cfg)},
		PythonRequirements: nil,
	}
}

func getDeploymentsDirectory(sourceDir util.Path) util.Path {
	return sourceDir.Join(".posit", "deployments")
}

// listDeployments returns a list of the previous
// deployments for this source directory.
func listDeployments(sourceDir util.Path, log logging.Logger) ([]*deployment.Deployment, error) {
	deploymentsDir := getDeploymentsDirectory(sourceDir)
	dirContents, err := deploymentsDir.ReadDir()
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// It's OK for the directory not to exist;
			// that means there are no prior deployments.
			return nil, nil
		} else {
			return nil, err
		}
	}
	deployments := make([]*deployment.Deployment, 0, len(dirContents))
	for _, fileInfo := range dirContents {
		if !fileInfo.IsDir() {
			deployment, err := deployment.FromFile(deploymentsDir.Join(fileInfo.Name()))
			if err != nil {
				return nil, err
			}
			deployments = append(deployments, deployment)
		}
	}
	sort.Slice(deployments, func(i, j int) bool {
		return deployments[i].ServerURL < deployments[j].ServerURL
	})
	return deployments, nil
}

// GetMostRecentDeployment returns the contents of the metadata
// store for the most recently deployed bundle. This is
// the default metadata that will be used when redeploying.
// Returns nil if there are no prior deployments.
func GetMostRecentDeployment(sourceDir util.Path, log logging.Logger) (*deployment.Deployment, error) {
	deployments, err := listDeployments(sourceDir, log)
	if err != nil {
		return nil, err
	}
	if len(deployments) == 0 {
		return nil, nil
	}
	return deployments[0], nil
}
