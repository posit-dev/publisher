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

// Merge merges the values from another deployment into this one.
// Usually `d` will have default values, or be preloaded from
// saved metadata. `other` is typically the CLI arguments.
func (d *Deployment) Merge(other *Deployment) {
	if other.SourceDir.Path() != "" {
		d.SourceDir = other.SourceDir
	}
	if other.Target.ServerType != "" {
		d.Target.ServerType = other.Target.ServerType
	}
	if other.Target.ServerURL != "" {
		d.Target.ServerURL = other.Target.ServerURL
	}
	if other.Target.ContentId != "" {
		d.Target.ContentId = other.Target.ContentId
	}
	if other.Target.ContentName != "" {
		d.Target.ContentName = other.Target.ContentName
	}
	// Target is set during deployment, not from the CLI
	d.Manifest.Merge(&other.Manifest)
	d.PythonRequirements = append(d.PythonRequirements, other.PythonRequirements...)
	d.Connect.Merge(&other.Connect)
}

// LoadManifest reads the specified manifest file and populates
// the Manifest field in the deployment state. This can be used
// to read an arbitrary manifest file.
func (d *Deployment) LoadManifest(path util.Path, log logging.Logger) error {
	isDir, err := path.IsDir()
	if err != nil {
		return err
	}
	if isDir {
		path = path.Join(bundles.ManifestFilename)
	}
	manifest, err := bundles.ReadManifestFile(path)
	if err != nil {
		return err
	}
	d.Manifest = *manifest
	log.Info("Loaded manifest", "path", path)
	return nil
}

func getMetadataPath(sourceDir util.Path, configName string) util.Path {
	return getMetadataRoot(sourceDir).Join(configName)
}

func getMetadataRoot(sourceDir util.Path) util.Path {
	return sourceDir.Join(".posit", "deployments")
}

type MetadataLabel string

type deploymentSerializer interface {
	Save(label MetadataLabel, src any) error
	Load(label MetadataLabel, dest any) error
}

const idLabel MetadataLabel = "id"
const manifestLabel MetadataLabel = "manifest"

// LoadFromFiles loads the deployment state from metadata files.
// This should be called prior to processing higher-precedence
// sources such as the CLI, environment variables, and UI input.
func (d *Deployment) LoadFromFiles(sourceDir util.Path, configName string, log logging.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	serializer := newJsonSerializer(metaDir, log)
	return d.Load(serializer)
}

func (d *Deployment) Load(serializer deploymentSerializer) error {
	err := serializer.Load(idLabel, &d.Target)
	if err != nil {
		return err
	}
	err = serializer.Load(manifestLabel, &d.Manifest)
	if err != nil {
		return err
	}
	switch d.Target.ServerType {
	case accounts.ServerTypeConnect:
		err = d.Connect.load(serializer)
		if err != nil {
			return err
		}
	}
	return nil
}

func (d *Deployment) SaveToFiles(sourceDir util.Path, configName string, log logging.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	err := metaDir.MkdirAll(0777)
	if err != nil {
		return err
	}
	serializer := newJsonSerializer(metaDir, log)
	return d.Save(serializer)
}

func (d *Deployment) Save(serializer deploymentSerializer) error {
	err := serializer.Save(idLabel, &d.Target)
	if err != nil {
		return err
	}
	err = serializer.Save(manifestLabel, &d.Manifest)
	if err != nil {
		return err
	}
	switch d.Target.ServerType {
	case accounts.ServerTypeConnect:
		err = d.Connect.save(serializer)
		if err != nil {
			return err
		}
	}
	return nil
}

// listDeployments returns a list of the previous
// deployments for this source directory.
func listDeployments(sourceDir util.Path, log logging.Logger) ([]*Deployment, error) {
	deploymentsDir := getMetadataRoot(sourceDir)
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
