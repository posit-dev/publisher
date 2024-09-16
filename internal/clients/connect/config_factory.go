package connect

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ConnectConfigFactory interface {
	FromLocalManifest(manifestPath string) (*config.Config, *bundles.Manifest, error)
	FromRemoteManifest() (*ConnectGetContentDTO, *config.Config, *bundles.Manifest, error)
}

type defaultConnectConfigFactory struct {
	Client      APIClient
	ContentGUID types.ContentID
	Config      *config.Config
	ContentDTO  *ConnectGetContentDTO
	Manifest    *bundles.Manifest
	Log         logging.Logger
}

var _ ConnectConfigFactory = &defaultConnectConfigFactory{}

func NewConnectConfigFactory(client APIClient, guid types.ContentID, log logging.Logger) ConnectConfigFactory {
	return &defaultConnectConfigFactory{
		Client:      client,
		ContentGUID: guid,
		Config:      config.New(),
		ContentDTO:  nil,
		Manifest:    nil,
		Log:         log,
	}
}

func (f *defaultConnectConfigFactory) validateCredentials() error {
	_, err := f.Client.TestAuthentication(f.Log)
	return err
}

func (f *defaultConnectConfigFactory) getContentDTO() error {
	c, err := f.Client.GetContent(f.ContentGUID, f.Log)
	if err != nil {
		return err
	}
	f.ContentDTO = c
	return nil
}

func (f *defaultConnectConfigFactory) updateConfigFromContentDTO() error {
	// Assignments listed in order of ConnectGetContentDTO
	// so we don't miss any

	// Ignoring GUID value from c
	// Ignoring Name value from c

	util.AssignStrIfAvailable(&f.Config.Title, &f.ContentDTO.Title)

	f.Config.Description = f.ContentDTO.Description

	f.Config.Access.Type = config.AccessType(f.ContentDTO.AccessType)

	// Not assigning Locked or LockedMessage from c, but
	// we should alert on it, as updates will not be allowed

	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.ConnectionTimeout, &f.ContentDTO.ConnectionTimeout)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.ReadTimeout, &f.ContentDTO.ReadTimeout)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.InitTimeout, &f.ContentDTO.InitTimeout)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.IdleTimeout, &f.ContentDTO.IdleTimeout)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.MaxProcesses, &f.ContentDTO.MaxProcesses)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.MinProcesses, &f.ContentDTO.MinProcesses)
	util.AssignInt32IfAvailable(f.Config.Connect.Runtime.MaxConnsPerProcess, &f.ContentDTO.MaxConnsPerProcess)
	util.AssignFloat64IfAvailable(f.Config.Connect.Runtime.LoadFactor, &f.ContentDTO.LoadFactor)

	util.AssignFloat64IfAvailable(f.Config.Connect.Kubernetes.CPURequest, &f.ContentDTO.CpuRequest)
	util.AssignFloat64IfAvailable(f.Config.Connect.Kubernetes.CPULimit, &f.ContentDTO.CpuLimit)
	util.AssignInt64IfAvailable(f.Config.Connect.Kubernetes.MemoryRequest, &f.ContentDTO.MemoryRequest)
	util.AssignInt64IfAvailable(f.Config.Connect.Kubernetes.MemoryLimit, &f.ContentDTO.MemoryLimit)
	util.AssignInt32IfAvailable(f.Config.Connect.Kubernetes.AMDGPULimit, &f.ContentDTO.AmdGpuLimit)
	util.AssignInt32IfAvailable(f.Config.Connect.Kubernetes.NvidiaGPULimit, &f.ContentDTO.NvidiaGpuLimit)

	// skipping Created
	// skipping LastDeployed
	// skipping BundleId

	// Type/AppMode defaults to "unknown"
	if f.Config.Type != "unknown" &&
		config.ContentType(f.ContentDTO.AppMode) != "unknown" &&
		f.Config.Type != config.ContentType(f.ContentDTO.AppMode) {
		return fmt.Errorf("config already updated with different Type (AppMode): current=%s, requested=%s", string(f.Config.Type), string(config.ContentType(f.ContentDTO.AppMode)))
	}
	f.Config.Type = config.ContentType(f.ContentDTO.AppMode)
	f.Config.Category = f.ContentDTO.ContentCategory

	// skipping Parameterized

	util.AssignStrIfAvailable(&f.Config.Connect.Kubernetes.ClusterName, &f.ContentDTO.ClusterName)
	util.AssignStrIfAvailable(&f.Config.Connect.Kubernetes.ImageName, &f.ContentDTO.ImageName)
	util.AssignStrIfAvailable(&f.Config.Connect.Kubernetes.DefaultImageName, &f.ContentDTO.DefaultImageName)
	util.AssignBoolIfAvailable(f.Config.Connect.Kubernetes.DefaultREnvironmentManagement, &f.ContentDTO.DefaultREnvironmentManagement)
	util.AssignBoolIfAvailable(f.Config.Connect.Kubernetes.DefaultPyEnvironmentManagement, &f.ContentDTO.DefaultPyEnvironmentManagement)
	util.AssignStrIfAvailable(&f.Config.Connect.Kubernetes.ServiceAccountName, &f.ContentDTO.ServiceAccountName)

	r, valid := f.ContentDTO.RVersion.Get()
	if valid &&
		f.Config.R.Version != "" &&
		f.Config.R.Version != r {
		return fmt.Errorf("config already updated with different R Version: current=%s, requested=%s", string(f.Config.R.Version), string(r))
	}
	util.AssignStrIfAvailable(&f.Config.R.Version, &f.ContentDTO.RVersion)

	// skipping REnvironmentManagement

	py, valid := f.ContentDTO.PyVersion.Get()
	if valid &&
		f.Config.Python.Version != "" &&
		f.Config.Python.Version != py {
		return fmt.Errorf("config already updated with different Python Version: current=%s, requested=%s", string(f.Config.Python.Version), string(py))
	}
	util.AssignStrIfAvailable(&f.Config.Python.Version, &f.ContentDTO.PyVersion)

	// skipping PyEnvironmentManagement

	q, valid := f.ContentDTO.QuartoVersion.Get()
	if valid &&
		f.Config.Quarto.Version != "" &&
		f.Config.Quarto.Version != q {
		return fmt.Errorf("config already updated with different Quarto Version: current=%s, requested=%s", string(f.Config.Quarto.Version), string(q))
	}
	util.AssignStrIfAvailable(&f.Config.Quarto.Version, &f.ContentDTO.QuartoVersion)

	util.AssignStrIfAvailable(&f.Config.Connect.Access.RunAs, &f.ContentDTO.RunAs)
	f.Config.Connect.Access.RunAsCurrentUser = &f.ContentDTO.RunAsCurrentUser

	// skipping OwnerGUID
	// skipping ContentURL
	// skipping DashboardURL
	// skipping Role
	// skipping Vanity URL (for now)
	// skipping Id

	// always returning success until we get some additional checks in here
	return nil
}

func (f *defaultConnectConfigFactory) getContentManifest() error {
	bundleId, valid := f.ContentDTO.BundleId.Get()
	if !valid {
		return fmt.Errorf("unable to determine bundleId for content: %s", f.ContentGUID)
	}

	path, err := f.Client.DownloadBundle(f.ContentGUID, bundleId, f.Log)
	if err != nil {
		return err
	}

	manifest, err := bundles.ExtractManifest(path)
	if err != nil {
		return err
	}

	f.Manifest = manifest
	return nil
}

func (f *defaultConnectConfigFactory) updateConfigFromManifest() error {
	// make sure appMode matches if already set (defaults to "unknown")
	if f.Config.Type != "unknown" &&
		f.Manifest.Metadata.AppMode != "unknown" &&
		f.Config.Type != config.ContentType(f.Manifest.Metadata.AppMode) {
		return fmt.Errorf("config already updated with different Type (AppMode): current=%s, requested=%s", string(f.Config.Type), string(f.Manifest.Metadata.AppMode))
	}
	// one of these should be set, assigning in reverse priority order
	if f.Manifest.Metadata.PrimaryHtml != "" {
		f.Config.Entrypoint = f.Manifest.Metadata.PrimaryHtml
	}
	if f.Manifest.Metadata.PrimaryRmd != "" {
		f.Config.Entrypoint = f.Manifest.Metadata.PrimaryRmd
	}
	if f.Manifest.Metadata.Entrypoint != "" {
		f.Config.Entrypoint = f.Manifest.Metadata.Entrypoint
	}
	// make sure R Version matches if already set
	if f.Config.R.Version != "" &&
		f.Manifest.Platform != "" &&
		f.Config.R.Version != f.Manifest.Platform {
		return fmt.Errorf("config already updated with different R Version: current=%s, requested=%s", string(f.Config.R.Version), string(f.Manifest.Platform))
	}
	f.Config.R.Version = f.Manifest.Platform

	// make sure Python Version matches if set
	if f.Config.Python.Version != "" &&
		f.Manifest.Python.Version != "" &&
		f.Config.Python.Version != f.Manifest.Python.Version {
		return fmt.Errorf("config already updated with different Python Version: current=%s, requested=%s", string(f.Config.Python.Version), string(f.Manifest.Python.Version))
	}
	f.Config.Python.Version = f.Manifest.Python.Version
	f.Config.Python.PackageManager = f.Manifest.Python.PackageManager.Name
	f.Config.Python.PackageFile = f.Manifest.Python.PackageManager.Name

	if len(f.Config.Quarto.Engines) != 0 &&
		len(f.Manifest.Quarto.Engines) != 0 &&
		!reflect.DeepEqual(f.Config.Quarto.Engines, f.Manifest.Quarto.Engines) {
		return fmt.Errorf("config already updated with different Quarto Engines: current=[%s], requested=[%s]", strings.Join(f.Config.Quarto.Engines, ","), strings.Join(f.Manifest.Quarto.Engines, ","))
	}
	if f.Manifest.Quarto != nil {
		f.Config.Quarto.Engines = f.Manifest.Quarto.Engines
	}

	// TODO: Add files
	f.Config.Files = []string{}
	for file, _ := range f.Manifest.Files {
		f.Config.Files = append(f.Config.Files, file)
	}

	return nil
}

func (f *defaultConnectConfigFactory) FromLocalManifest(manifestPath string) (*config.Config, *bundles.Manifest, error) {
	// Validate Credentials
	err := f.validateCredentials()
	if err != nil {
		return nil, nil, err
	}

	// Get ContentDTO object from Connect Server
	err = f.getContentDTO()
	if err != nil {
		return nil, nil, err
	}

	// Update Config fields from ContentDTO
	err = f.updateConfigFromContentDTO()
	if err != nil {
		return nil, nil, err
	}

	// Get Manifest object from File
	// Update Config fields from Manifest
	err = f.updateConfigFromManifest()
	if err != nil {
		return nil, nil, err
	}

	return f.Config, f.Manifest, nil
}

func (f *defaultConnectConfigFactory) FromRemoteManifest() (*ConnectGetContentDTO, *config.Config, *bundles.Manifest, error) {
	// Validate Credentials
	err := f.validateCredentials()
	if err != nil {
		return nil, nil, nil, err
	}

	// Get ContentDTO object from Connect Server
	err = f.getContentDTO()
	if err != nil {
		return nil, nil, nil, err
	}

	// Update Config fields from ContentDTO
	err = f.updateConfigFromContentDTO()
	if err != nil {
		return nil, nil, nil, err
	}

	// Get Manifest object from Connect Server
	err = f.getContentManifest()
	if err != nil {
		return nil, nil, nil, err
	}

	// Update Config fields from Manifest
	err = f.updateConfigFromManifest()
	if err != nil {
		return nil, nil, nil, err
	}

	return f.ContentDTO, f.Config, f.Manifest, nil
}
