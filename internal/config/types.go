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
	ContentTypeUnknown         ContentType = "unknown"
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
		string(ContentTypePythonShiny),
		string(ContentTypePythonStreamlit),
		string(ContentTypeQuartoShiny),
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
	Entrypoint    string      `toml:"entrypoint" json:"entrypoint,omitempty"`
	Validate      bool        `toml:"validate" json:"validate"`
	Files         []string    `toml:"files" json:"files"`
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
	PackageFile    string `toml:"package-file" json:"packageFile"`
	PackageManager string `toml:"package-manager" json:"packageManager"`
}

type R struct {
	Version        string `toml:"version" json:"version"`
	PackageFile    string `toml:"package-file" json:"packageFile"`
	PackageManager string `toml:"package-manager" json:"packageManager"`
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
	RunAs            string `toml:"run-as,omitempty" json:"runAs,omitempty"`
	RunAsCurrentUser *bool  `toml:"run-as-current-user,omitempty" json:"runAsCurrentUser,omitempty"`
}

type ConnectRuntime struct {
	ConnectionTimeout  *int32   `toml:"connection-timeout,omitempty" json:"connectionTimeout,omitempty"`
	ReadTimeout        *int32   `toml:"read-timeout,omitempty" json:"readTimeout,omitempty"`
	InitTimeout        *int32   `toml:"init-timeout,omitempty" json:"initTimeout,omitempty"`
	IdleTimeout        *int32   `toml:"idle-timeout,omitempty" json:"idleTimeout,omitempty"`
	MaxProcesses       *int32   `toml:"max-processes,omitempty" json:"maxProcesses,omitempty"`
	MinProcesses       *int32   `toml:"min-processes,omitempty" json:"minProcesses,omitempty"`
	MaxConnsPerProcess *int32   `toml:"max-connections,omitempty" json:"maxConnections,omitempty"`
	LoadFactor         *float64 `toml:"load-factor,omitempty" json:"loadFactor,omitempty"`
}

type ConnectKubernetes struct {
	MemoryRequest                  *int64   `toml:"memory-request,omitempty" json:"memoryRequest,omitempty"`
	MemoryLimit                    *int64   `toml:"memory-limit,omitempty" json:"memoryLimit,omitempty"`
	CPURequest                     *float64 `toml:"cpu-request,omitempty" json:"cpuRequest,omitempty"`
	CPULimit                       *float64 `toml:"cpu-limit,omitempty" json:"cpuLimit,omitempty"`
	AMDGPULimit                    *int64   `toml:"amd-gpu-limit,omitempty" json:"amdGpuLimit,omitempty"`
	NvidiaGPULimit                 *int64   `toml:"nvidia-gpu-limit,omitempty" json:"nvidiaGpuLimit,omitempty"`
	ServiceAccountName             string   `toml:"service-account-name,omitempty" json:"serviceAccountName,omitempty"`
	DefaultImageName               string   `toml:"image-name,omitempty" json:"imageName,omitempty"`
	DefaultREnvironmentManagement  *bool    `toml:"r-environment-management,omitempty" json:"rEnvironmentManagement"`
	DefaultPyEnvironmentManagement *bool    `toml:"py-environment-management,omitempty" json:"pyEnvironmentManagement"`
}
