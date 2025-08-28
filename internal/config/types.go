package config

import (
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/interpreters"
)

// Copyright (C) 2023 by Posit Software, PBC.

// Use ContentType from contenttypes package
type ContentType = contenttypes.ContentType

type Config struct {
	Comments            []string             `toml:"-" json:"comments,omitempty"`
	Alternatives        []Config             `toml:"-" json:"alternatives,omitempty"`
	ProductType         ProductType          `toml:"product_type" json:"productType,omitempty"`
	Schema              string               `toml:"$schema" json:"$schema,omitempty"`
	Type                ContentType          `toml:"type" json:"type,omitempty"`
	Entrypoint          string               `toml:"entrypoint" json:"entrypoint,omitempty"`
	EntrypointObjectRef string               `toml:"-" json:"entrypointObjectRef,omitempty"`
	Validate            *bool                `toml:"validate" json:"validate,omitempty"`
	HasParameters       *bool                `toml:"has_parameters,omitempty" json:"hasParameters,omitempty"`
	Files               []string             `toml:"files,multiline" json:"files"`
	Title               string               `toml:"title,omitempty" json:"title,omitempty"`
	Description         string               `toml:"description,multiline,omitempty" json:"description,omitempty"`
	ThumbnailFile       string               `toml:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	Tags                []string             `toml:"tags,omitempty" json:"tags,omitempty"`
	Python              *Python              `toml:"python,omitempty" json:"python,omitempty"`
	R                   *R                   `toml:"r,omitempty" json:"r,omitempty"`
	Jupyter             *Jupyter             `toml:"jupyter,omitempty" json:"jupyter,omitempty"`
	Quarto              *Quarto              `toml:"quarto,omitempty" json:"quarto,omitempty"`
	Environment         Environment          `toml:"environment,omitempty" json:"environment,omitempty"`
	Secrets             []string             `toml:"secrets,omitempty" json:"secrets,omitempty"`
	Schedules           []Schedule           `toml:"schedules,omitempty" json:"schedules,omitempty"`
	Connect             *Connect             `toml:"connect,omitempty" json:"connect,omitempty"`
	ConnectCloud        *ConnectCloud        `toml:"connect_cloud,omitempty" json:"connectCloud,omitempty"`
	IntegrationRequests []IntegrationRequest `toml:"integration_requests,omitempty,inline,multiline" json:"integration_requests,omitempty"`
}

func (c *Config) PopulateDefaults() {
	if c.ProductType == "" {
		c.ProductType = ProductTypeConnect
	}
}

func (c *Config) GetValidate() bool {
	if c.Validate == nil {
		return false
	}
	return *c.Validate
}

func (c *Config) GetHasParameters() bool {
	if c.HasParameters == nil {
		return false
	}
	return *c.HasParameters
}

// ForceProductTypeCompliance modifies the config in place to ensure that it complies with the JSON schema.
func (c *Config) ForceProductTypeCompliance() {
	if c.ProductType.IsConnectCloud() {
		// These fields are disallowed by the schema
		if c.Python != nil {
			c.Python.PackageManager = ""
			c.Python.PackageFile = ""
			c.Python.RequiresPythonVersion = ""

			if c.Python.Version != "" {
				// Connect Cloud requires Python version to be in the format "X.Y"
				pythonVersionSplit := strings.Split(c.Python.Version, ".")
				if len(pythonVersionSplit) >= 2 {
					c.Python.Version = fmt.Sprintf("%s.%s", pythonVersionSplit[0], pythonVersionSplit[1])
				}
			}
		}
		if c.R != nil {
			c.R.PackageManager = ""
			c.R.PackageFile = ""
			c.R.RequiresRVersion = ""
		}
		c.Quarto = nil
		c.Jupyter = nil
	} else if c.ProductType.IsConnect() {
		// object-reference-style entrypoint is only allowed by Connect
		if c.EntrypointObjectRef != "" {
			c.Entrypoint = c.EntrypointObjectRef
		}
	}
	// unset the field to ensure it doesn't appear in the object undergoing schema validation
	c.EntrypointObjectRef = ""
	// unset alternatives so it doesn't interfere with schema validation
	c.Alternatives = nil
}

type ProductType string

const (
	ProductTypeConnect      ProductType = "connect"
	ProductTypeConnectCloud ProductType = "connect_cloud"
)

func (p ProductType) IsConnect() bool {
	return p == ProductTypeConnect
}

func (p ProductType) IsConnectCloud() bool {
	return p == ProductTypeConnectCloud
}

func (c *Config) HasSecret(secret string) bool {
	for _, s := range c.Secrets {
		if s == secret {
			return true
		}
	}
	return false
}

type Environment = map[string]string

type Python struct {
	Version               string `toml:"version,omitempty" json:"version,omitempty"`
	PackageFile           string `toml:"package_file,omitempty" json:"packageFile,omitempty"`
	PackageManager        string `toml:"package_manager,omitempty" json:"packageManager,omitempty"`
	RequiresPythonVersion string `toml:"requires_python,omitempty" json:"requiresPython,omitempty"`
}

func (p *Python) FillDefaults(
	pythonInterpreter interpreters.PythonInterpreter,
) {
	if pythonInterpreter.IsPythonExecutableValid() {
		python := pythonInterpreter
		if p.Version == "" {
			pythonVersion, pythonVersionError := python.GetPythonVersion()
			if pythonVersionError == nil {
				p.Version = pythonVersion
			}
		}
		if p.PackageFile == "" {
			pythonLockFile, _, pythonLockFileError := python.GetLockFilePath()
			if pythonLockFileError == nil {
				p.PackageFile = pythonLockFile.String()
			}
		}
		if p.PackageManager == "" {
			p.PackageManager = python.GetPackageManager()
		}
		if p.RequiresPythonVersion == "" {
			p.RequiresPythonVersion = python.GetPythonRequires()
		}
	}
}

type R struct {
	Version          string `toml:"version,omitempty" json:"version,omitempty"`
	PackageFile      string `toml:"package_file,omitempty" json:"packageFile,omitempty"`
	PackageManager   string `toml:"package_manager,omitempty" json:"packageManager,omitempty"`
	RequiresRVersion string `toml:"requires_r,omitempty" json:"requiresR,omitempty"`
}

func (r *R) FillDefaults(
	rInterpreter interpreters.RInterpreter,
) {
	if rInterpreter.IsRExecutableValid() {
		rLang := rInterpreter
		if r.Version == "" {
			rVersion, rVersionError := rLang.GetRVersion()
			if rVersionError == nil {
				r.Version = rVersion
			}
		}
		if r.PackageFile == "" {
			rLockFile, _, rLockFileError := rLang.GetLockFilePath()
			if rLockFileError == nil {
				r.PackageFile = rLockFile.String()
			}
		}
		if r.PackageManager == "" {
			r.PackageManager = rLang.GetPackageManager()
		}
		if r.RequiresRVersion == "" {
			r.RequiresRVersion = rLang.GetRRequires()
		}
	}
}

type Jupyter struct {
	HideAllInput    bool `toml:"hide_all_input,omitempty" json:"hideAllInput,omitempty"`
	HideTaggedInput bool `toml:"hide_tagged_input,omitempty" json:"hideTaggedInput,omitempty"`
}

type Quarto struct {
	Version string   `toml:"version,omitempty" json:"version,omitempty"`
	Engines []string `toml:"engines,omitempty" json:"engines,omitempty"`
}

type Schedule struct {
	Start      string `toml:"start,omitempty" json:"start,omitempty"`
	Recurrence string `toml:"recurrence,omitempty" json:"recurrence,omitempty"`
}

type AccessType string

const (
	AccessTypeAnonymous AccessType = "all"
	AccessTypeLoggedIn  AccessType = "logged-in"
	AccessTypeACL       AccessType = "acl"
)

type ConnectAccessControl struct {
	Type   AccessType `toml:"type" json:"type,omitempty"`
	Users  []User     `toml:"users,omitempty" json:"users,omitempty"`
	Groups []Group    `toml:"groups,omitempty" json:"groups,omitempty"`
}

type User struct {
	Id          string `toml:"id,omitempty" json:"id,omitempty"`
	GUID        string `toml:"guid,omitempty" json:"guid,omitempty"`
	Name        string `toml:"name,omitempty" json:"name,omitempty"`
	Permissions string `toml:"permissions" json:"permissions"`
}

type Group struct {
	Id          string `toml:"id,omitempty" json:"id,omitempty"`
	GUID        string `toml:"guid,omitempty" json:"guid,omitempty"`
	Name        string `toml:"name,omitempty" json:"name,omitempty"`
	Permissions string `toml:"permissions" json:"permissions"`
}

type Connect struct {
	Access        *ConnectAccess        `toml:"access,omitempty" json:"access,omitempty"`
	AccessControl *ConnectAccessControl `toml:"access_control,omitempty" json:"accessControl,omitempty"`
	Runtime       *ConnectRuntime       `toml:"runtime,omitempty" json:"runtime,omitempty"`
	Kubernetes    *ConnectKubernetes    `toml:"kubernetes,omitempty" json:"kubernetes,omitempty"`
}

type ConnectAccess struct {
	RunAs            string `toml:"run_as,omitempty" json:"runAs,omitempty"`
	RunAsCurrentUser *bool  `toml:"run_as_current_user,omitempty" json:"runAsCurrentUser,omitempty"`
}

type ConnectRuntime struct {
	ConnectionTimeout  *int32   `toml:"connection_timeout,omitempty" json:"connectionTimeout,omitempty"`
	ReadTimeout        *int32   `toml:"read_timeout,omitempty" json:"readTimeout,omitempty"`
	InitTimeout        *int32   `toml:"init_timeout,omitempty" json:"initTimeout,omitempty"`
	IdleTimeout        *int32   `toml:"idle_timeout,omitempty" json:"idleTimeout,omitempty"`
	MaxProcesses       *int32   `toml:"max_processes,omitempty" json:"maxProcesses,omitempty"`
	MinProcesses       *int32   `toml:"min_processes,omitempty" json:"minProcesses,omitempty"`
	MaxConnsPerProcess *int32   `toml:"max_conns_per_process,omitempty" json:"maxConnsPerProcess,omitempty"`
	LoadFactor         *float64 `toml:"load_factor,omitempty" json:"loadFactor,omitempty"`
}

type ConnectKubernetes struct {
	MemoryRequest                  *int64   `toml:"memory_request,omitempty" json:"memoryRequest,omitempty"`
	MemoryLimit                    *int64   `toml:"memory_limit,omitempty" json:"memoryLimit,omitempty"`
	CPURequest                     *float64 `toml:"cpu_request,omitempty" json:"cpuRequest,omitempty"`
	CPULimit                       *float64 `toml:"cpu_limit,omitempty" json:"cpuLimit,omitempty"`
	AMDGPULimit                    *int64   `toml:"amd_gpu_limit,omitempty" json:"amdGpuLimit,omitempty"`
	NvidiaGPULimit                 *int64   `toml:"nvidia_gpu_limit,omitempty" json:"nvidiaGpuLimit,omitempty"`
	ServiceAccountName             string   `toml:"service_account_name,omitempty" json:"serviceAccountName,omitempty"`
	DefaultImageName               string   `toml:"default_image_name,omitempty" json:"defaultImageName,omitempty"`
	DefaultREnvironmentManagement  *bool    `toml:"default_r_environment_management,omitempty" json:"defaultREnvironmentManagement,omitempty"`
	DefaultPyEnvironmentManagement *bool    `toml:"default_py_environment_management,omitempty" json:"defaultPyEnvironmentManagement,omitempty"`
}

type ConnectCloud struct {
	VanityName    string                     `toml:"vanity_name,omitempty" json:"vanityName,omitempty"`
	AccessControl *ConnectCloudAccessControl `toml:"access_control,omitempty" json:"accessControl,omitempty"`
}

type OrganizationAccessType string

const (
	OrganizationAccessTypeDisabled OrganizationAccessType = "disabled"
	OrganizationAccessTypeViewer   OrganizationAccessType = "viewer"
	OrganizationAccessTypeEditor   OrganizationAccessType = "editor"
)

type ConnectCloudAccessControl struct {
	PublicAccess       *bool                  `toml:"public_access,omitempty"  json:"publicAccess,omitempty"`
	OrganizationAccess OrganizationAccessType `toml:"organization_access,omitempty" json:"organizationAccess,omitempty"`
}

type IntegrationRequest struct {
	Guid            string         `toml:"guid,omitempty" json:"guid,omitempty"`
	Name            string         `toml:"name,omitempty" json:"name,omitempty"`
	Description     string         `toml:"description,omitempty" json:"description,omitempty"`
	AuthType        string         `toml:"auth_type,omitempty" json:"auth_type,omitempty"`
	IntegrationType string         `toml:"type,omitempty" json:"type,omitempty"`
	Config          map[string]any `toml:"config,omitempty" json:"config,omitempty"`
}
