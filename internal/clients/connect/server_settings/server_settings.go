package server_settings

import (
	"strings"
)

// The type definitions here are lifted from Connect's server_settings.
// See the Connect source for more information on these fields.

type ServerSettings struct {
	NodeName                              string                 `json:"hostname"`
	Version                               string                 `json:"version"`
	Build                                 string                 `json:"build"`
	About                                 string                 `json:"about"`
	Authentication                        authenticationSettings `json:"authentication"`
	License                               LicenseStatus          `json:"license"`
	LicenseExpirationUIWarning            bool                   `json:"license_expiration_ui_warning"`
	DeprecatedSettings                    bool                   `json:"deprecated_settings"`
	DeprecatedSettingsUIWarning           bool                   `json:"deprecated_settings_ui_warning"`
	ViewerKiosk                           bool                   `json:"viewer_kiosk"`
	MailAll                               bool                   `json:"mail_all"`
	MailConfigured                        bool                   `json:"mail_configured"`
	PublicWarning                         string                 `json:"public_warning"`
	LoggedInWarning                       string                 `json:"logged_in_warning"`
	LogoutURL                             string                 `json:"logout_url"`
	MetricsRRDEnabled                     bool                   `json:"metrics_rrd_enabled"`
	MetricsInstrumentation                bool                   `json:"metrics_instrumentation"`
	CustomizedLanding                     bool                   `json:"customized_landing"`
	SelfRegistration                      bool                   `json:"self_registration"`
	ProhibitedUsernames                   []string               `json:"prohibited_usernames"`
	UsernameValidator                     string                 `json:"username_validator"`
	ViewersCanOnlySeeThemselves           bool                   `json:"viewers_can_only_see_themselves"`
	HTTPWarning                           bool                   `json:"http_warning"`
	QueueUI                               bool                   `json:"queue_ui"`
	Runtimes                              []string               `json:"runtimes"`
	DefaultContentListView                string                 `json:"default_content_list_view"`
	MaximumAppImageSize                   int                    `json:"maximum_app_image_size"`
	ServerSettingsToggler                 bool                   `json:"server_settings_toggler"`
	GitEnabled                            bool                   `json:"git_enabled"`
	GitAvailable                          bool                   `json:"git_available"`
	DashboardPath                         string                 `json:"dashboard_path"`
	SystemDisplayName                     string                 `json:"system_display_name"`
	HideViewerDocumentation               bool                   `json:"hide_viewer_documentation"`
	JumpStartEnabled                      bool                   `json:"jump_start_enabled"`
	PermissionRequest                     bool                   `json:"permission_request"`
	TableauIntegrationEnabled             bool                   `json:"tableau_integration_enabled"`
	SelfTestEnabled                       bool                   `json:"self_test_enabled"`
	ExecutionType                         string                 `json:"execution_type"`
	EnableRuntimeConstraints              bool                   `json:"enable_runtime_constraints"`
	EnableImageManagement                 bool                   `json:"enable_image_management"`
	AllowRuntimeCacheManagement           bool                   `json:"enable_runtime_cache_management"`
	DefaultImageSelectionEnabled          bool                   `json:"default_image_selection_enabled"`
	DefaultEnvironmentManagementSelection bool                   `json:"default_environment_management_selection"`
	DefaultREnvironmentManagement         bool                   `json:"default_r_environment_management"`
	DefaultPyEnvironmentManagement        bool                   `json:"default_py_environment_management"`
	NewParameterizationEnabled            bool                   `json:"new_parameterization_enabled"`
	UseWindowLocation                     bool                   `json:"use_window_location"`
}

const ExecutionTypeNative = "native"
const ExecutionTypeLocal = "launcher-local"
const ExecutionTypeKubernetes = "launcher-kubernetes"

type ApplicationSettings struct {
	ViewerOnDemandReports   bool     `json:"viewer_ondemand_reports"`
	ViewerCustomizedReports bool     `json:"viewer_customized_reports"`
	AccessTypes             []string `json:"access_types"`
	RunAs                   string   `json:"run_as"`
	RunAsGroup              string   `json:"run_as_group"`
	RunAsCurrentUser        bool     `json:"run_as_current_user"`
}

type SchedulerSettings struct {
	MinProcesses       int64   `json:"min_processes"`
	MaxProcesses       int64   `json:"max_processes"`
	MaxConnsPerProcess int64   `json:"max_conns_per_process"`
	LoadFactor         float64 `json:"load_factor"`
	InitTimeout        int64   `json:"init_timeout"`
	IdleTimeout        int64   `json:"idle_timeout"`
	MinProcessesLimit  int64   `json:"min_processes_limit"`
	MaxProcessesLimit  int64   `json:"max_processes_limit"`
	ConnectionTimeout  int64   `json:"connection_timeout"`
	ReadTimeout        int64   `json:"read_timeout"`

	CPURequest        float64 `json:"cpu_request"`
	MaxCPURequest     float64 `json:"max_cpu_request"`
	CPULimit          float64 `json:"cpu_limit"`
	MaxCPULimit       float64 `json:"max_cpu_limit"`
	MemoryRequest     int64   `json:"memory_request"`
	MaxMemoryRequest  int64   `json:"max_memory_request"`
	MemoryLimit       int64   `json:"memory_limit"`
	MaxMemoryLimit    int64   `json:"max_memory_limit"`
	AMDGPULimit       int64   `json:"amd_gpu_limit"`
	MaxAMDGPULimit    int64   `json:"max_amd_gpu_limit"`
	NvidiaGPULimit    int64   `json:"nvidia_gpu_limit"`
	MaxNvidiaGPULimit int64   `json:"max_nvidia_gpu_limit"`
}

type authenticationSettings struct {
	ProviderAttributes
	Name         string `json:"name"`
	Notice       string `json:"notice"`
	WarningDelay int64  `json:"warning_delay"`
}

type ProviderAttributes struct {
	HandlesCredentials bool `json:"handles_credentials"`
	HandlesLogin       bool `json:"handles_login"`
	SupportsChallenge  bool `json:"challenge_response_enabled"`
	ProviderUserAttributes
	ProviderGroupAttributes
	ProviderUserProfileAttributes
}

type ProviderUserProfileAttributes struct {
	UniqueUsernames    bool               `json:"unique_usernames"`
	NameEditableBy     UserInfoEditableBy `json:"name_editable_by"`
	EmailEditableBy    UserInfoEditableBy `json:"email_editable_by"`
	UsernameEditableBy UserInfoEditableBy `json:"username_editable_by"`
	RoleEditableBy     UserInfoEditableBy `json:"role_editable_by"`
}

type ProviderUserAttributes struct {
	ExternalUserData   bool `json:"external_user_data"`
	ExternalUserSearch bool `json:"external_user_search"`
	ExternalUserId     bool `json:"external_user_id"`
}

type ProviderGroupAttributes struct {
	GroupsEnabled        bool `json:"groups_enabled"`
	ExternalGroupSearch  bool `json:"external_group_search"`
	ExternalGroupMembers bool `json:"external_group_members"`
	ExternalGroupId      bool `json:"external_group_id"`
	ExternalGroupOwner   bool `json:"external_group_owner"`
}

type LicenseStatus struct {
	Timestamp            float64 `json:"ts"`
	Status               string  `json:"status"`
	Expiration           float64 `json:"expiration"`
	DaysLeft             int64   `json:"days-left"`
	HasKey               bool    `json:"has-key"`
	HasTrial             bool    `json:"has-trial"`
	Tier                 string  `json:"tier"`
	SKUYear              string  `json:"sku-year"`
	Edition              string  `json:"edition"`
	Cores                int     `json:"cores"`
	Connections          int     `json:"connections"`
	Type                 string  `json:"type"`
	Users                int     `json:"users"`
	UserActivityDays     int     `json:"user-activity-days"`
	UsersGrace           bool    `json:"users-grace,string"`
	ShinyUsers           int     `json:"shiny-users"`
	AllowAPIs            bool    `json:"allow-apis"`
	CustomBranding       bool    `json:"custom-branding"`
	CurrentUserExecution bool    `json:"current-user-execution"`
	AnonymousServers     bool    `json:"anonymous-servers"`
	AnonymousBranding    bool    `json:"anonymous-branding"`
	LauncherEnabled      bool    `json:"enable-launcher"`
}

type UserInfoEditableBy UserInfoEditableType

func NewUserInfoEditableByFromType(t UserInfoEditableType) UserInfoEditableBy {
	return UserInfoEditableBy(strings.ToLower(string(t)))
}

func (c UserInfoEditableBy) Type() UserInfoEditableType {
	switch strings.ToLower(string(c)) {
	case "adminandself":
		return UserEditAdminAndSelf
	case "admin":
		return UserEditAdmin
	case "provider":
		return UserEditProvider
	}
	return UserEditProvider
}

type UserInfoEditableType string

const (
	UserEditProvider     UserInfoEditableType = "Provider"
	UserEditAdmin        UserInfoEditableType = "Admin"
	UserEditAdminAndSelf UserInfoEditableType = "AdminAndSelf"
)

type PyInstallation struct {
	Version     string `json:"version"`
	ClusterName string `json:"cluster_name"`
	ImageName   string `json:"image_name"`
}

type PyInfo struct {
	Installations []PyInstallation `json:"installations"`
	APIEnabled    bool             `json:"api_enabled"`
}

type RInstallation struct {
	Version     string `json:"version"`
	ClusterName string `json:"cluster_name"`
	ImageName   string `json:"image_name"`
}

type RInfo struct {
	Installations []RInstallation `json:"installations"`
}

type QuartoInstallation struct {
	Version     string `json:"version"`
	ClusterName string `json:"cluster_name"`
	ImageName   string `json:"image_name"`
}

type QuartoInfo struct {
	Installations []QuartoInstallation `json:"installations"`
}
