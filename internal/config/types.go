package config

// Copyright (C) 2023 by Posit Software, PBC.

type ContentType string

const (
	ContentTypeHTML            ContentType = "html"
	ContentTypeJupyterNotebook ContentType = "jupyter-notebook"
	ContentTypeJupyterVoila    ContentType = "jupyter-voila"
	ContentTypePythonBokeh     ContentType = "python-bokeh"
	ContentTypePythonDash      ContentType = "python-dash"
	ContentTypePythonFastAPI   ContentType = "python-fastapi"
	ContentTypePythonFlask     ContentType = "python-flask"
	ContentTypePythonShiny     ContentType = "python-shiny"
	ContentTypePythonStreamlit ContentType = "python-streamlit"
	ContentTypeQuartoShiny     ContentType = "quarto-shiny"
	ContentTypeQuarto          ContentType = "quarto"
	ContentTypeRPlumber        ContentType = "r-plumber"
	ContentTypeRShiny          ContentType = "r-shiny"
	ContentTypeRMarkdownShiny  ContentType = "rmd-shiny"
	ContentTypeRMarkdown       ContentType = "rmd"
)

func (t ContentType) IsPythonContent() bool {
	switch t {
	case
		ContentTypeJupyterNotebook,
		ContentTypeJupyterVoila,
		ContentTypePythonBokeh,
		ContentTypePythonDash,
		ContentTypePythonFastAPI,
		ContentTypePythonFlask,
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
		ContentTypePythonStreamlit:
		return true
	}
	return false
}

type Config struct {
	Schema        string      `toml:"$schema" json:"$schema"`
	Type          ContentType `toml:"type" json:"type"`
	Entrypoint    string      `toml:"entrypoint,omitempty" json:"entrypoint,omitempty"`
	Validate      bool        `toml:"validate" json:"validate"`
	Title         string      `toml:"title,omitempty" json:"title,omitempty"`
	Description   string      `toml:"description,multiline,omitempty" json:"description,omitempty"`
	ThumbnailFile string      `toml:"thumbnail,omitempty" json:"thumbnail,omitempty"`
	Tags          []string    `toml:"tags,omitempty" json:"tags,omitempty"`
	Python        *Python     `toml:"python,omitempty" json:"python,omitempty"`
	R             *R          `toml:"r,omitempty" json:"r,omitempty"`
	Quarto        *Quarto     `toml:"quarto,omitempty" json:"quarto,omitempty"`
	Environment   Environment `toml:"environment,omitempty" json:"environment,omitempty"`
	Secrets       []string    `toml:"secrets,omitempty" json:"secrets,omitempty"`
	Schedules     []Schedule  `toml:"schedules,omitempty" json:"schedules,omitempty"`
	Access        *Access     `toml:"access,omitempty" json:"access,omitempty"`
	Connect       *Connect    `toml:"connect,omitempty" json:"connect,omitempty"`
}

type Environment = map[string]string

type Python struct {
	Version        string `toml:"version" json:"version"`
	PackageFile    string `toml:"package-file" json:"package-file"`
	PackageManager string `toml:"package-manager" json:"package-manager"`
}

type R struct {
	Version        string `toml:"version" json:"version"`
	PackageFile    string `toml:"package-file" json:"package-file"`
	PackageManager string `toml:"package-manager" json:"package-manager"`
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

type Access struct {
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
	Access     *ConnectAccess     `toml:"access,omitempty" json:"access,omitempty"`
	Runtime    *ConnectRuntime    `toml:"runtime,omitempty" json:"runtime,omitempty"`
	Kubernetes *ConnectKubernetes `toml:"kubernetes,omitempty" json:"kubernetes,omitempty"`
}

type ConnectAccess struct {
	RunAs            string `toml:"run-as,omitempty" json:"run-as,omitempty"`
	RunAsCurrentUser *bool  `toml:"run-as-current-user,omitempty" json:"run-as-current-user,omitempty"`
}

type ConnectRuntime struct {
	ConnectionTimeout  *int32   `toml:"connection-timeout,omitempty" json:"connection-timeout,omitempty"`
	ReadTimeout        *int32   `toml:"read-timeout,omitempty" json:"read-timeout,omitempty"`
	InitTimeout        *int32   `toml:"init-timeout,omitempty" json:"init-timeout,omitempty"`
	IdleTimeout        *int32   `toml:"idle-timeout,omitempty" json:"idle-timeout,omitempty"`
	MaxProcesses       *int32   `toml:"max-processes,omitempty" json:"max-processes,omitempty"`
	MinProcesses       *int32   `toml:"min-processes,omitempty" json:"min-processes,omitempty"`
	MaxConnsPerProcess *int32   `toml:"max-connections,omitempty" json:"max-connections,omitempty"`
	LoadFactor         *float64 `toml:"load-factor,omitempty" json:"load-factor,omitempty"`
}

type ConnectKubernetes struct {
	MemoryRequest                  *int64   `toml:"memory-request,omitempty" json:"memory-request,omitempty"`
	MemoryLimit                    *int64   `toml:"memory-limit,omitempty" json:"memory-limit,omitempty"`
	CPURequest                     *float64 `toml:"cpu-request,omitempty" json:"cpu-request,omitempty"`
	CPULimit                       *float64 `toml:"cpu-limit,omitempty" json:"cpu-limit,omitempty"`
	AMDGPULimit                    *int64   `toml:"amd-gpu-limit,omitempty" json:"amd-gpu-limit,omitempty"`
	NvidiaGPULimit                 *int64   `toml:"nvidia-gpu-limit,omitempty" json:"nvidia-gpu-limit,omitempty"`
	ServiceAccountName             string   `toml:"service-account-name,omitempty" json:"service-account-name,omitempty"`
	DefaultImageName               string   `toml:"image-name,omitempty" json:"image-name,omitempty"`
	DefaultREnvironmentManagement  *bool    `toml:"default-r-environment-management,omitempty" json:"defaultREnvironmentManagement"`
	DefaultPyEnvironmentManagement *bool    `toml:"default-py-environment-management,omitempty" json:"defaultPyEnvironmentManagement"`
}
