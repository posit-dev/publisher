package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type TargetID struct {
	ServerType  accounts.ServerType    `json:"server_type"`  // Which type of API this server provides
	ServerName  string                 `json:"server_name"`  // Nickname
	ServerURL   string                 `json:"server_url"`   // Server URL
	ContentId   apitypes.NullContentID `json:"content_id"`   // Content ID (GUID for Connect)
	ContentName apitypes.ContentName   `json:"content_name"` // Content Name (unique per user)

	// These fields are informational and don't affect future deployments.
	Username   string                `json:"username"`    // Username, if known
	BundleId   apitypes.NullBundleID `json:"bundle_id"`   // Bundle ID that was deployed
	DeployedAt apitypes.NullTime     `json:"deployed_at"` // Date/time bundle was deployed
}

type Deployment struct {
	SourceDir          string            `kong:"-"` // Absolute path to source directory being published
	Target             TargetID          `kong:"-"` // Identity of previous deployment
	Manifest           bundles.Manifest  `embed:""` // manifest.json content for this deployment
	PythonRequirements []byte            `kong:"-"` // Content of requirements.txt to include
	Connect            ConnectDeployment `embed:""` // Connect metadata for this deployment, if target is Connect
}

func NewDeployment() *Deployment {
	return &Deployment{
		Manifest: *bundles.NewManifest(),
	}
}

// LoadManifest reads the specified manifest file and populates
// the Manifest field in the deployment state. This can be used
// to read an arbitrary manifest file.
func (d *Deployment) LoadManifest(fs afero.Fs, path string, logger rslog.Logger) error {
	isDir, err := afero.IsDir(fs, path)
	if err != nil {
		return err
	}
	if isDir {
		path = filepath.Join(path, bundles.ManifestFilename)
	}
	manifest, err := bundles.ReadManifestFile(fs, path)
	if err != nil {
		return err
	}
	d.Manifest = *manifest
	logger.Infof("Loaded manifest from %s", path)
	return nil
}

func getMetadataPath(sourceDir string, configName string) string {
	return filepath.Join(sourceDir, ".posit", "deployments", configName)
}

type metadataLabel string

type deploymentSerializer interface {
	Save(label metadataLabel, src any) error
	Load(label metadataLabel, dest any) error
}

const idLabel metadataLabel = "id"

// LoadFromFiles loads the deployment state from metadata files.
// This should be called prior to processing higher-precedence
// sources such as the CLI, environment variables, and UI input.
func (d *Deployment) LoadFromFiles(fs afero.Fs, sourceDir string, configName string, logger rslog.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	serializer := newJsonSerializer(fs, metaDir, logger)
	return d.Load(serializer)
}

func (d *Deployment) Load(serializer deploymentSerializer) error {
	err := serializer.Load(idLabel, &d.Target)
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

func (d *Deployment) SaveToFiles(fs afero.Fs, sourceDir string, configName string, logger rslog.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	err := fs.MkdirAll(metaDir, 0777)
	if err != nil {
		return err
	}
	serializer := newJsonSerializer(fs, metaDir, logger)
	return d.Save(serializer)
}

func (d *Deployment) Save(serializer deploymentSerializer) error {
	err := serializer.Save(idLabel, &d.Target)
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
