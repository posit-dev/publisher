package config

import (
	"github.com/posit-dev/publisher/internal/interpreters"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ContentType string

const (
	ContentTypeHTML             ContentType = "html"
	ContentTypeJupyterNotebook  ContentType = "jupyter-notebook"
	ContentTypeJupyterVoila     ContentType = "jupyter-voila"
	ContentTypePythonBokeh      ContentType = "python-bokeh"
	ContentTypePythonDash       ContentType = "python-dash"
	ContentTypePythonFastAPI    ContentType = "python-fastapi"
	ContentTypePythonFlask      ContentType = "python-flask"
	ContentTypePythonShiny      ContentType = "python-shiny"
	ContentTypePythonStreamlit  ContentType = "python-streamlit"
	ContentTypePythonGradio     ContentType = "python-gradio"
	ContentTypeQuartoShiny      ContentType = "quarto-shiny"
	ContentTypeQuartoDeprecated ContentType = "quarto"
	ContentTypeQuarto           ContentType = "quarto-static"
	ContentTypeRPlumber         ContentType = "r-plumber"
	ContentTypeRShiny           ContentType = "r-shiny"
	ContentTypeRMarkdownShiny   ContentType = "rmd-shiny"
	ContentTypeRMarkdown        ContentType = "rmd"
	ContentTypeUnknown          ContentType = "unknown"
)

func AllValidContentTypeNames() []string {
	return []string{
		string(ContentTypeHTML),
		string(ContentTypeJupyterNotebook),
		string(ContentTypeJupyterVoila),
		string(ContentTypePythonBokeh),
		string(ContentTypePythonDash),
		string(ContentTypePythonFastAPI),
		string(ContentTypePythonFlask),
		string(ContentTypePythonGradio),
		string(ContentTypePythonShiny),
		string(ContentTypePythonStreamlit),
		string(ContentTypeQuartoShiny),
		string(ContentTypeQuartoDeprecated),
		string(ContentTypeQuarto),
		string(ContentTypeRPlumber),
		string(ContentTypeRShiny),
		string(ContentTypeRMarkdownShiny),
		string(ContentTypeRMarkdown),
		// omit ContentTypeUnknown
	}
}

func (t ContentType) IsPythonContent() bool {
	switch t {
	case
		ContentTypeJupyterNotebook,
		ContentTypeJupyterVoila,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonFastAPI,
		ContentTypePythonFlask,
		ContentTypePythonGradio,
		ContentTypePythonShiny,
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

func (t ContentType) IsAPIContent() bool {
	switch t {
	case ContentTypePythonFlask,
		ContentTypePythonFastAPI,
		ContentTypeRPlumber:
		return true
	}
	return false
}

func (t ContentType) IsAppContent() bool {
	switch t {
	case ContentTypePythonShiny,
		ContentTypeRShiny,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonGradio,
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

type Config struct {
	Comments      []string    `toml:"-" json:"comments"`
	ProductType   ProductType `toml:"product_type" json:"productType"`
	Schema        string      `toml:"$schema" json:"$schema"`
	Type          ContentType `toml:"type" json:"type"`
	Entrypoint    string      `toml:"entrypoint" json:"entrypoint,omitempty"`
	Validate      bool        `toml:"validate" json:"validate"`
	HasParameters bool        `toml:"has_parameters,omitempty" json:"hasParameters"`
	Files         []string    `toml:"files,multiline" json:"files"`
	Title         string      `toml:"title,omitempty" json:"title,omitempty"`
	Description   string      `toml:"description,multiline,omitempty" json:"description,omitempty"`
	ThumbnailFile string      `toml:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	Tags          []string    `toml:"tags,omitempty" json:"tags,omitempty"`
	Python        *Python     `toml:"python,omitempty" json:"python,omitempty"`
	R             *R          `toml:"r,omitempty" json:"r,omitempty"`
	Jupyter       *Jupyter    `toml:"jupyter,omitempty" json:"jupyter,omitempty"`
	Quarto        *Quarto     `toml:"quarto,omitempty" json:"quarto,omitempty"`
	Environment   Environment `toml:"environment,omitempty" json:"environment,omitempty"`
	Secrets       []string    `toml:"secrets,omitempty" json:"secrets,omitempty"`
	Schedules     []Schedule  `toml:"schedules,omitempty" json:"schedules,omitempty"`
	Connect       *Connect    `toml:"connect,omitempty" json:"connect,omitempty"`
}

type ProductType string

const (
	ProductTypeConnect      ProductType = "connect"
	ProductTypeConnectCloud ProductType = "connect_cloud"
)

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
	Version               string `toml:"version,omitempty" json:"version"`
	PackageFile           string `toml:"package_file,omitempty" json:"packageFile"`
	PackageManager        string `toml:"package_manager,omitempty" json:"packageManager"`
	RequiresPythonVersion string `toml:"requires_python,omitempty" json:"requiresPython"`
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
	Version          string `toml:"version,omitempty" json:"version"`
	PackageFile      string `toml:"package_file,omitempty" json:"packageFile"`
	PackageManager   string `toml:"package_manager,omitempty" json:"packageManager"`
	RequiresRVersion string `toml:"requires_r,omitempty" json:"requiresR"`
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
	HideAllInput    bool `toml:"hide_all_input,omitempty" json:"hideAllInput"`
	HideTaggedInput bool `toml:"hide_tagged_input,omitempty" json:"hideTaggedInput"`
}

type Quarto struct {
	Version string   `toml:"version" json:"version"`
	Engines []string `toml:"engines" json:"engines"`
}

type Schedule struct {
	Start      string `toml:"start" json:"start"`
	Recurrence string `toml:"recurrence" json:"recurrence"`
}

type AccessType string

const (
	AccessTypeAnonymous AccessType = "all"
	AccessTypeLoggedIn  AccessType = "logged-in"
	AccessTypeACL       AccessType = "acl"
)

type ConnectAccessControl struct {
	Type   AccessType `toml:"type" json:"type"`
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
	DefaultREnvironmentManagement  *bool    `toml:"default_r_environment_management,omitempty" json:"defaultREnvironmentManagement"`
	DefaultPyEnvironmentManagement *bool    `toml:"default_py_environment_management,omitempty" json:"defaultPyEnvironmentManagement"`
}
