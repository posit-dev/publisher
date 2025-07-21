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
	Comments      []string              `toml:"-" mapstructure:"-" json:"comments"`
	Schema        string                `toml:"$schema" mapstructure:"$schema" json:"$schema"`
	Type          ContentType           `toml:"type" mapstructure:"type" json:"type"`
	Entrypoint    string                `toml:"entrypoint" mapstructure:"entrypoint" json:"entrypoint,omitempty"`
	Validate      bool                  `toml:"validate" mapstructure:"validate" json:"validate"`
	HasParameters bool                  `toml:"has_parameters,omitempty" mapstructure:"has_parameters,omitempty" json:"hasParameters"`
	Files         []string              `toml:"files,multiline" mapstructure:"files" json:"files"`
	Title         string                `toml:"title,omitempty" mapstructure:"title,omitempty" json:"title,omitempty"`
	Description   string                `toml:"description,multiline,omitempty" mapstructure:"description,omitempty" json:"description,omitempty"`
	ThumbnailFile string                `toml:"thumbnail,omitempty" mapstructure:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	Tags          []string              `toml:"tags,omitempty" mapstructure:"tags,omitempty" json:"tags,omitempty"`
	Python        *Python               `toml:"python,omitempty" mapstructure:"python,omitempty" json:"python,omitempty"`
	R             *R                    `toml:"r,omitempty" mapstructure:"r,omitempty" json:"r,omitempty"`
	Jupyter       *Jupyter              `toml:"jupyter,omitempty" mapstructure:"jupyter,omitempty" json:"jupyter,omitempty"`
	Quarto        *Quarto               `toml:"quarto,omitempty" mapstructure:"quarto,omitempty" json:"quarto,omitempty"`
	Environment   Environment           `toml:"environment,omitempty" mapstructure:"environment,omitempty" json:"environment,omitempty"`
	Secrets       []string              `toml:"secrets,omitempty" mapstructure:"secrets,omitempty" json:"secrets,omitempty"`
	Schedules     []Schedule            `toml:"schedules,omitempty" mapstructure:"schedules,omitempty" json:"schedules,omitempty"`
	Access        *ConnectAccessControl `toml:"access,omitempty" json:"access,omitempty"`
	Connect       *Connect              `toml:"connect,omitempty" mapstructure:"connect,omitempty" json:"connect,omitempty"`
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
	Version               string `toml:"version,omitempty" mapstructure:"version,omitempty" json:"version"`
	PackageFile           string `toml:"package_file,omitempty" mapstructure:"package_file,omitempty" json:"packageFile"`
	PackageManager        string `toml:"package_manager,omitempty" mapstructure:"package_manager,omitempty" json:"packageManager"`
	RequiresPythonVersion string `toml:"requires_python,omitempty" mapstructure:"requires_python,omitempty" json:"requiresPython"`
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
	Version          string `toml:"version,omitempty" mapstructure:"version,omitempty" json:"version"`
	PackageFile      string `toml:"package_file,omitempty" mapstructure:"package_file,omitempty" json:"packageFile"`
	PackageManager   string `toml:"package_manager,omitempty" mapstructure:"package_manager,omitempty" json:"packageManager"`
	RequiresRVersion string `toml:"requires_r,omitempty" mapstructure:"requires_r,omitempty" json:"requiresR"`
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
	HideAllInput    bool `toml:"hide_all_input,omitempty" mapstructure:"hide_all_input,omitempty" json:"hideAllInput"`
	HideTaggedInput bool `toml:"hide_tagged_input,omitempty" mapstructure:"hide_tagged_input,omitempty" json:"hideTaggedInput"`
}

type Quarto struct {
	Version string   `toml:"version" mapstructure:"version" json:"version"`
	Engines []string `toml:"engines" mapstructure:"engines" json:"engines"`
}

type Schedule struct {
	Start      string `toml:"start" mapstructure:"start" json:"start"`
	Recurrence string `toml:"recurrence" mapstructure:"recurrence" json:"recurrence"`
}

type AccessType string

const (
	AccessTypeAnonymous AccessType = "all"
	AccessTypeLoggedIn  AccessType = "logged-in"
	AccessTypeACL       AccessType = "acl"
)

type ConnectAccessControl struct {
	Type   AccessType `toml:"type" mapstructure:"type" json:"type"`
	Users  []User     `toml:"users,omitempty" mapstructure:"users,omitempty" json:"users,omitempty"`
	Groups []Group    `toml:"groups,omitempty" mapstructure:"groups,omitempty" json:"groups,omitempty"`
}

type User struct {
	Id          string `toml:"id,omitempty" mapstructure:"id,omitempty" json:"id,omitempty"`
	GUID        string `toml:"guid,omitempty" mapstructure:"guid,omitempty" json:"guid,omitempty"`
	Name        string `toml:"name,omitempty" mapstructure:"name,omitempty" json:"name,omitempty"`
	Permissions string `toml:"permissions" mapstructure:"permissions" json:"permissions"`
}

type Group struct {
	Id          string `toml:"id,omitempty" mapstructure:"id,omitempty" json:"id,omitempty"`
	GUID        string `toml:"guid,omitempty" mapstructure:"guid,omitempty" json:"guid,omitempty"`
	Name        string `toml:"name,omitempty" mapstructure:"name,omitempty" json:"name,omitempty"`
	Permissions string `toml:"permissions" mapstructure:"permissions" json:"permissions"`
}

type Connect struct {
	Access     *ConnectSystemAccess `toml:"access,omitempty" mapstructure:"access,omitempty" json:"access,omitempty"`
	Runtime    *ConnectRuntime      `toml:"runtime,omitempty" mapstructure:"runtime,omitempty" json:"runtime,omitempty"`
	Kubernetes *ConnectKubernetes   `toml:"kubernetes,omitempty" mapstructure:"kubernetes,omitempty" json:"kubernetes,omitempty"`
}

type ConnectSystemAccess struct {
	RunAs            string `toml:"run_as,omitempty" mapstructure:"run_as,omitempty" json:"runAs,omitempty"`
	RunAsCurrentUser *bool  `toml:"run_as_current_user,omitempty" mapstructure:"run_as_current_user,omitempty" json:"runAsCurrentUser,omitempty"`
}

type ConnectRuntime struct {
	ConnectionTimeout  *int32   `toml:"connection_timeout,omitempty" mapstructure:"connection_timeout,omitempty" json:"connectionTimeout,omitempty"`
	ReadTimeout        *int32   `toml:"read_timeout,omitempty" mapstructure:"read_timeout,omitempty" json:"readTimeout,omitempty"`
	InitTimeout        *int32   `toml:"init_timeout,omitempty" mapstructure:"init_timeout,omitempty" json:"initTimeout,omitempty"`
	IdleTimeout        *int32   `toml:"idle_timeout,omitempty" mapstructure:"idle_timeout,omitempty" json:"idleTimeout,omitempty"`
	MaxProcesses       *int32   `toml:"max_processes,omitempty" mapstructure:"max_processes,omitempty" json:"maxProcesses,omitempty"`
	MinProcesses       *int32   `toml:"min_processes,omitempty" mapstructure:"min_processes,omitempty" json:"minProcesses,omitempty"`
	MaxConnsPerProcess *int32   `toml:"max_conns_per_process,omitempty" mapstructure:"max_conns_per_process,omitempty" json:"maxConnsPerProcess,omitempty"`
	LoadFactor         *float64 `toml:"load_factor,omitempty" mapstructure:"load_factor,omitempty" json:"loadFactor,omitempty"`
}

type ConnectKubernetes struct {
	MemoryRequest                  *int64   `toml:"memory_request,omitempty" mapstructure:"memory_request,omitempty" json:"memoryRequest,omitempty"`
	MemoryLimit                    *int64   `toml:"memory_limit,omitempty" mapstructure:"memory_limit,omitempty" json:"memoryLimit,omitempty"`
	CPURequest                     *float64 `toml:"cpu_request,omitempty" mapstructure:"cpu_request,omitempty" json:"cpuRequest,omitempty"`
	CPULimit                       *float64 `toml:"cpu_limit,omitempty" mapstructure:"cpu_limit,omitempty" json:"cpuLimit,omitempty"`
	AMDGPULimit                    *int64   `toml:"amd_gpu_limit,omitempty" mapstructure:"amd_gpu_limit,omitempty" json:"amdGpuLimit,omitempty"`
	NvidiaGPULimit                 *int64   `toml:"nvidia_gpu_limit,omitempty" mapstructure:"nvidia_gpu_limit,omitempty" json:"nvidiaGpuLimit,omitempty"`
	ServiceAccountName             string   `toml:"service_account_name,omitempty" mapstructure:"service_account_name,omitempty" json:"serviceAccountName,omitempty"`
	DefaultImageName               string   `toml:"default_image_name,omitempty" mapstructure:"default_image_name,omitempty" json:"defaultImageName,omitempty"`
	DefaultREnvironmentManagement  *bool    `toml:"default_r_environment_management,omitempty" mapstructure:"default_r_environment_management,omitempty" json:"defaultREnvironmentManagement"`
	DefaultPyEnvironmentManagement *bool    `toml:"default_py_environment_management,omitempty" mapstructure:"default_py_environment_management,omitempty" json:"defaultPyEnvironmentManagement"`
}
