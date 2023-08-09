package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type TargetID struct {
	AccountName string               `json:"account_name" short:"n" help:"Nickname of destination publishing account."` // Nickname
	ServerType  accounts.ServerType  `json:"server_type" kong:"-"`                                                      // Which type of API this server provides
	ServerURL   string               `json:"server_url" kong:"-"`                                                       // Server URL
	ContentId   apitypes.ContentID   `json:"content_id" help:"Unique ID of content item to update."`                    // Content ID (GUID for Connect)
	ContentName apitypes.ContentName `json:"content_name" help:"Name of content item to update."`                       // Content Name (unique per user)

	// These fields are informational and don't affect future deployments.
	Username   string                `json:"username,omitempty" kong:"-"` // Username, if known
	BundleId   apitypes.NullBundleID `json:"bundle_id" kong:"-"`          // Bundle ID that was deployed
	DeployedAt apitypes.NullTime     `json:"deployed_at" kong:"-"`        // Date/time bundle was deployed
}

type Deployment struct {
	SourceDir          util.Path         `json:"source_path" kong:"-"`         // Absolute path to source directory being published
	Target             TargetID          `json:"target" kong:"embed"`          // Identity of previous deployment
	Manifest           bundles.Manifest  `json:"mainfest" kong:"embed"`        // manifest.json content for this deployment
	Connect            ConnectDeployment `json:"connect" kong:"embed"`         // Connect metadata for this deployment, if target is Connect
	PythonRequirements []byte            `json:"python_requirements" kong:"-"` // Content of requirements.txt to include
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
	if other.Target.AccountName != "" {
		d.Target.AccountName = other.Target.AccountName
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
func (d *Deployment) LoadManifest(path util.Path, logger rslog.Logger) error {
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
	logger.Infof("Loaded manifest from %s", path)
	return nil
}

func getMetadataPath(sourceDir util.Path, configName string) util.Path {
	return sourceDir.Join(".posit", "deployments", configName)
}

type MetadataLabel string

type deploymentSerializer interface {
	Save(label MetadataLabel, src any) error
	Load(label MetadataLabel, dest any) error
}

const idLabel MetadataLabel = "id"

// LoadFromFiles loads the deployment state from metadata files.
// This should be called prior to processing higher-precedence
// sources such as the CLI, environment variables, and UI input.
func (d *Deployment) LoadFromFiles(sourceDir util.Path, configName string, logger rslog.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	serializer := newJsonSerializer(metaDir, logger)
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

func (d *Deployment) SaveToFiles(sourceDir util.Path, configName string, logger rslog.Logger) error {
	metaDir := getMetadataPath(sourceDir, configName)
	err := metaDir.MkdirAll(0777)
	if err != nil {
		return err
	}
	serializer := newJsonSerializer(metaDir, logger)
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
