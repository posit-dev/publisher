package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io/fs"
	"sort"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type TargetID struct {
	ServerType  accounts.ServerType `json:"server_type"`                                            // Which type of API this server provides
	ServerURL   string              `json:"server_url"`                                             // Server URL
	ContentId   types.ContentID     `json:"content_id" help:"Unique ID of content item to update."` // Content ID (GUID for Connect)
	ContentName types.ContentName   `json:"content_name" help:"Name of content item to update."`    // Content Name (unique per user)

	// These fields are informational and don't affect future deployments.
	Username string             `json:"username,omitempty"` // Username, if known
	BundleId types.NullBundleID `json:"bundle_id"`          // Bundle ID that was deployed
}

type LocalDeploymentID string

func NewLocalID() (LocalDeploymentID, error) {
	str, err := util.RandomString(16)
	if err != nil {
		return LocalDeploymentID(""), err
	}
	return LocalDeploymentID(str), nil
}

type ConnectDeployment struct {
	Content ConnectContent `json:"content"`
}

type Deployment struct {
	LocalID            LocalDeploymentID `json:"local_id"`            // Unique ID of this publishing operation. Only valid for this run of the agent.
	SourceDir          util.Path         `json:"source_path"`         // Absolute path to source directory being published
	Target             TargetID          `json:"target"`              // Identity of previous deployment
	Manifest           bundles.Manifest  `json:"manifest"`            // manifest.json content for this deployment
	Connect            ConnectDeployment `json:"connect"`             // Connect metadata for this deployment, if target is Connect
	PythonRequirements []byte            `json:"python_requirements"` // Content of requirements.txt to include
}

func NewDeployment() *Deployment {
	return &Deployment{
		Manifest: *bundles.NewManifest(),
	}
}

func getDeploymentsDirectory(sourceDir util.Path) util.Path {
	return sourceDir.Join(".posit", "deployments")
}

// listDeployments returns a list of the previous
// deployments for this source directory.
func listDeployments(sourceDir util.Path, log logging.Logger) ([]*Deployment, error) {
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
	deployments := []*Deployment{}
	for _, fileInfo := range dirContents {
		if fileInfo.IsDir() {
			deployment := NewDeployment()

			err = deployment.LoadFromFiles(sourceDir, fileInfo.Name(), log)
			if err != nil {
				return nil, err
			}
			deployments = append(deployments, deployment)
		}
	}
	sort.Slice(deployments, func(i, j int) bool {
		return deployments[i].Target.ServerURL < deployments[j].Target.ServerURL
	})
	return deployments, nil
}

// GetMostRecentDeployment returns the contents of the metadata
// store for the most recently deployed bundle. This is
// the default metadata that will be used when redeploying.
// Returns nil if there are no prior deployments.
func GetMostRecentDeployment(sourceDir util.Path, log logging.Logger) (*Deployment, error) {
	deployments, err := listDeployments(sourceDir, log)
	if err != nil {
		return nil, err
	}
	if len(deployments) == 0 {
		return nil, nil
	}
	return deployments[0], nil
}
