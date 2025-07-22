package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"strings"
	"sync"
	"time"

	"github.com/posit-dev/publisher/internal/server_type"

	"github.com/pelletier/go-toml/v2"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/project"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

var DeploymentRecordMutex sync.Mutex

type Deployment struct {
	// Predeployment and full deployment fields
	Schema        string                 `toml:"$schema" mapstructure:"$schema" json:"$schema"`
	ServerType    server_type.ServerType `toml:"server_type" mapstructure:"server_type" json:"serverType"`
	ServerURL     string                 `toml:"server_url" mapstructure:"server_url" json:"serverUrl"`
	AccountName   string                 `toml:"account_name" mapstructure:"account_name" json:"accountName"`
	ClientVersion string                 `toml:"client_version" mapstructure:"client_version" json:"-"`
	CreatedAt     string                 `toml:"created_at" mapstructure:"created_at" json:"createdAt"`
	DismissedAt   string                 `toml:"dismissed_at" mapstructure:"dismissed_at" json:"dismissedAt"`
	Type          config.ContentType     `toml:"type" mapstructure:"type" json:"type"`
	ConfigName    string                 `toml:"configuration_name" mapstructure:"configuration_name" json:"configurationName"`
	ID            types.ContentID        `toml:"id,omitempty" mapstructure:"id,omitempty" json:"id"`
	DashboardURL  string                 `toml:"dashboard_url,omitempty" mapstructure:"dashboard_url,omitempty" json:"dashboardUrl"`
	DirectURL     string                 `toml:"direct_url,omitempty" mapstructure:"direct_url,omitempty" json:"directUrl"`
	LogsURL       string                 `toml:"logs_url,omitempty" mapstructure:"logs_url,omitempty" json:"logsUrl"`

	// Full deployment fields
	DeployedAt    string            `toml:"deployed_at,omitempty" mapstructure:"deployed_at,omitempty" json:"deployedAt"`
	BundleID      types.BundleID    `toml:"bundle_id,omitempty" mapstructure:"bundle_id,omitempty" json:"bundleId"`
	BundleURL     string            `toml:"bundle_url,omitempty" mapstructure:"bundle_url,omitempty" json:"bundleUrl"`
	Error         *types.AgentError `toml:"deployment_error,omitempty" mapstructure:"deployment_error,omitempty" json:"deploymentError"`
	Files         []string          `toml:"files,multiline,omitempty" mapstructure:"files,omitempty" json:"files"`
	Requirements  []string          `toml:"requirements,multiline,omitempty" mapstructure:"requirements,omitempty" json:"requirements"`
	Configuration *config.Config    `toml:"configuration,omitempty" mapstructure:"configuration,omitempty" json:"configuration"`
	Renv          *renv.Lockfile    `toml:"renv,omitempty" mapstructure:"renv,omitempty" json:"renv"`
}

func New() *Deployment {
	return &Deployment{
		Schema:        schema.DeploymentSchemaURL,
		ServerType:    server_type.ServerTypeConnect,
		ClientVersion: project.Version,
		Type:          config.ContentTypeUnknown,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
}

func GetDeploymentsPath(base util.AbsolutePath) util.AbsolutePath {
	return base.Join(".posit", "publish", "deployments")
}

func GetDeploymentPath(base util.AbsolutePath, name string) util.AbsolutePath {
	return GetDeploymentsPath(base).Join(name + ".toml")
}

func ListDeploymentFiles(base util.AbsolutePath) ([]util.AbsolutePath, error) {
	dir := GetDeploymentsPath(base)
	return dir.Glob("*.toml")
}

func UntitledDeploymentName(base util.AbsolutePath) (string, error) {
	for i := 1; ; i++ {
		name := fmt.Sprintf("Untitled-%d", i)
		exists, err := GetDeploymentPath(base, name).Exists()
		if err != nil {
			return "", err
		}
		if !exists {
			return name, nil
		}
	}
}

func SaveNameFromPath(path util.AbsolutePath) string {
	return strings.TrimSuffix(path.Base(), ".toml")
}

func RenameDeployment(base util.AbsolutePath, oldName, newName string) error {
	err := util.ValidateFilename(newName)
	if err != nil {
		return err
	}
	oldPath := GetDeploymentPath(base, oldName)
	newPath := GetDeploymentPath(base, newName)
	return oldPath.Rename(newPath.Path)
}

func FromFile(path util.AbsolutePath) (*Deployment, error) {
	data, err := ValidateFile(path)
	if err != nil {
		return nil, err
	}

	err = schema.UpgradePublishingRecordSchema(data)
	if err != nil {
		return nil, fmt.Errorf("failed to upgrade deployment schema to latest version: %w", err)
	}

	d := New()
	err = util.DecodeTOMLMap(data, d)
	if err != nil {
		return nil, fmt.Errorf("failed to decode publishing record schema schema: %w", err)
	}

	// Migration
	if d.LogsURL == "" && d.ID != "" {
		d.LogsURL = util.GetLogsURL(d.ServerURL, d.ID)
	}
	return d, nil
}

func ValidateFile(path util.AbsolutePath) (map[string]interface{}, error) {
	validator, err := schema.NewValidator[Deployment](schema.DeploymentSchemaURLs)
	if err != nil {
		return nil, err
	}
	return validator.ValidateTOMLFile(path)
}

const autogenHeader = "# This file is automatically generated by Posit Publisher; do not edit.\n"

func (d *Deployment) IsDeployed() bool {
	return d.ID != ""
}

func (d *Deployment) Write(w io.Writer) error {
	_, err := w.Write([]byte(autogenHeader))
	if err != nil {
		return err
	}
	enc := toml.NewEncoder(w)
	return enc.Encode(d)
}

// When being called from methods active during a deployment, they will be running within a
// go function with a state which includes a localID. By supplying it when calling this method,
// they protect the deployment file from being updated by any methods active but not current.
//
// NOTE: deployment threads currently run to completion, so when a user "dismisses" a deployment
// the go functions continue to want to update the record (even though they might be "old" news)
func (d *Deployment) WriteFile(
	path util.AbsolutePath,
	localIdIfDeploying string,
	log logging.Logger,
) (*Deployment, error) {

	// Single threaded through here, to control simultaneous thread updates
	DeploymentRecordMutex.Lock()
	defer DeploymentRecordMutex.Unlock()

	log.Debug("Attempting to update deployment record", "path", path, "localIdIfDeploying", localIdIfDeploying)

	if localIdIfDeploying != "" {
		// we will only update the deployment record, if the local id passed in
		// owns the record (as determined by the ActiveDeploymentRegistry)
		// matches (which confirms the ownership of the record vs. another deployment thread)
		existingDeployment, err := FromFile(path)
		if err != nil {
			// If the deployment file doesn't exist, that's ok
			if !errors.Is(err, fs.ErrNotExist) {
				// we have an invalid deployment file.
				// we'll have to fail in error.
				return nil, err
			}
		}
		if existingDeployment != nil {
			if !ActiveDeploymentRegistry.Check(path.String(), localIdIfDeploying) {
				log.Debug("Skipping deployment record update since existing record is being updated by another thread.")
				return existingDeployment, nil
			}
		}
	}

	log.Debug("Updating deployment record", "path", path)

	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return nil, err
	}
	f, err := path.Create()
	if err != nil {
		return nil, err
	}

	defer f.Close()
	err = d.Write(f)
	if err != nil {
		return nil, err
	}
	return d, nil
}
