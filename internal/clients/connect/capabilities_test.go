package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/clients/connect/server_settings"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type CapabilitiesSuite struct {
	utiltest.Suite
}

func TestCapabilitiesSuite(t *testing.T) {
	suite.Run(t, new(CapabilitiesSuite))
}

func (s *CapabilitiesSuite) TestEmptyConfig() {
	a := allSettings{}
	cfg := &config.Config{}
	s.NoError(a.checkConfig(cfg))
}

func makePythonConfig(version string) *config.Config {
	return &config.Config{
		Python: &config.Python{
			Version: version,
		},
	}
}

func (s *CapabilitiesSuite) TestCheckMatchingPython() {
	a := allSettings{
		python: server_settings.PyInfo{
			Installations: []server_settings.PyInstallation{
				{Version: "3.10.1"},
				{Version: "3.11.2"},
			},
		},
	}
	s.NoError(a.checkConfig(makePythonConfig("3.10.1")))
	s.NoError(a.checkConfig(makePythonConfig("3.11.1")))
	s.NotNil(a.checkConfig(makePythonConfig("3.9.1")))
}

func makeMinMaxProcs(min, max int32) *config.Config {
	return &config.Config{
		Type: config.ContentTypePythonShiny,
		Connect: &config.Connect{
			Runtime: &config.ConnectRuntime{
				MinProcesses: &min,
				MaxProcesses: &max,
			},
		},
	}
}

func (s *CapabilitiesSuite) TestMinMaxProcs() {
	a := allSettings{
		scheduler: server_settings.SchedulerSettings{
			MinProcesses:      0,
			MaxProcesses:      3,
			MinProcessesLimit: 10,
			MaxProcessesLimit: 20,
		},
	}
	s.NoError(a.checkConfig(makeMinMaxProcs(1, 5)))
	s.NoError(a.checkConfig(makeMinMaxProcs(5, 5)))
	s.ErrorContains(a.checkConfig(makeMinMaxProcs(11, 11)), "min-processes value of 11 is higher than configured maximum of 10 on this server")
	s.ErrorContains(a.checkConfig(makeMinMaxProcs(0, 21)), "max-processes value of 21 is higher than configured maximum of 20 on this server")
	s.ErrorContains(a.checkConfig(makeMinMaxProcs(5, 1)), "min-processes value of 5 is higher than max-processes value of 1")
	s.ErrorContains(a.checkConfig(makeMinMaxProcs(-1, 5)), "min-processes value cannot be less than 0")
}

func (s *CapabilitiesSuite) TestRuntimeNonWorker() {
	cfg := &config.Config{
		Type: config.ContentTypeHTML,
		Connect: &config.Connect{
			Runtime: &config.ConnectRuntime{},
		},
	}
	a := allSettings{}
	s.ErrorIs(a.checkConfig(cfg), errRuntimeSettingsForStaticContent)
}

func (s *CapabilitiesSuite) TestRunAs() {
	adminSettings := allSettings{
		user: UserDTO{
			UserRole: AuthRoleAdmin,
		},
	}
	publisherSettings := allSettings{
		user: UserDTO{
			UserRole: AuthRolePublisher,
		},
	}
	cfg := &config.Config{
		Connect: &config.Connect{
			Access: &config.ConnectAccess{
				RunAs: "someuser",
			},
		},
	}
	s.NoError(adminSettings.checkConfig(cfg))
	s.ErrorContains(publisherSettings.checkConfig(cfg), "run-as requires administrator privileges")
}

func (s *CapabilitiesSuite) TestRunAsCurrentUser() {
	goodSettings := allSettings{
		user: UserDTO{
			UserRole: AuthRoleAdmin,
		},
		general: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				CurrentUserExecution: true,
			},
		},
		application: server_settings.ApplicationSettings{
			RunAsCurrentUser: true,
		},
	}
	truth := true
	cfg := config.Config{
		Type: config.ContentTypePythonDash,
		Connect: &config.Connect{
			Access: &config.ConnectAccess{
				RunAsCurrentUser: &truth,
			},
		},
	}
	s.NoError(goodSettings.checkConfig(&cfg))

	noLicense := goodSettings
	noLicense.general.License.CurrentUserExecution = false
	s.ErrorIs(noLicense.checkConfig(&cfg), errCurrentUserExecutionNotLicensed)

	noConfig := goodSettings
	noConfig.application.RunAsCurrentUser = false
	s.ErrorIs(noConfig.checkConfig(&cfg), errCurrentUserExecutionNotConfigured)

	notAdmin := goodSettings
	notAdmin.user.UserRole = AuthRolePublisher
	s.ErrorContains(notAdmin.checkConfig(&cfg), "run-as-current-user requires administrator privileges")

	notAnApp := cfg
	notAnApp.Type = config.ContentTypeJupyterNotebook
	s.ErrorIs(goodSettings.checkConfig(&notAnApp), errOnlyAppsCanRACU)
}

func (s *CapabilitiesSuite) TestAPILicense() {
	allowed := allSettings{
		general: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				AllowAPIs: true,
			},
		},
	}
	notAllowed := allSettings{
		general: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				AllowAPIs: false,
			},
		},
	}
	missing := allSettings{}
	cfg := &config.Config{
		Type: config.ContentTypePythonFlask,
	}
	s.NoError(allowed.checkConfig(cfg))
	s.ErrorIs(missing.checkConfig(cfg), errAPIsNotLicensed)
	s.ErrorIs(notAllowed.checkConfig(cfg), errAPIsNotLicensed)
}

func (s *CapabilitiesSuite) TestFieldLengths() {
	a := allSettings{}
	tooLong := strings.Repeat("spam", 10000)
	cfg := &config.Config{
		Description: tooLong,
	}
	s.ErrorIs(a.checkConfig(cfg), errDescriptionTooLong)
}

func (s *CapabilitiesSuite) TestKubernetesEnablement() {
	goodSettings := allSettings{
		user: UserDTO{
			UserRole: AuthRoleAdmin,
		},
		general: server_settings.ServerSettings{
			ExecutionType:                server_settings.ExecutionTypeKubernetes,
			DefaultImageSelectionEnabled: true,
			License: server_settings.LicenseStatus{
				LauncherEnabled: true,
			},
		},
	}

	cfg := config.Config{
		Connect: &config.Connect{
			Kubernetes: &config.ConnectKubernetes{
				DefaultImageName:   "image",
				ServiceAccountName: "account",
			},
		},
	}
	s.NoError(goodSettings.checkConfig(&cfg))

	noLicense := goodSettings
	noLicense.general.License.LauncherEnabled = false
	s.ErrorIs(noLicense.checkConfig(&cfg), errKubernetesNotLicensed)

	noConfig := goodSettings
	noConfig.general.ExecutionType = server_settings.ExecutionTypeLocal
	s.ErrorIs(noConfig.checkConfig(&cfg), errKubernetesNotConfigured)

	noImageSelection := goodSettings
	noImageSelection.general.DefaultImageSelectionEnabled = false
	s.ErrorIs(noImageSelection.checkConfig(&cfg), errImageSelectionNotEnabled)

	noAdmin := goodSettings
	noAdmin.user.UserRole = AuthRolePublisher
	s.ErrorContains(noAdmin.checkConfig(&cfg), "service-account-name requires administrator privileges")
}

func makeCpuRequestLimit(req, limit float64) *config.Config {
	return &config.Config{
		Connect: &config.Connect{
			Kubernetes: &config.ConnectKubernetes{
				CPURequest: &req,
				CPULimit:   &limit,
			},
		},
	}
}

func makeMemoryRequestLimit(req, limit int64) *config.Config {
	return &config.Config{
		Connect: &config.Connect{
			Kubernetes: &config.ConnectKubernetes{
				MemoryRequest: &req,
				MemoryLimit:   &limit,
			},
		},
	}
}

func makeGPURequest(amd, nvidia int64) *config.Config {
	return &config.Config{
		Connect: &config.Connect{
			Kubernetes: &config.ConnectKubernetes{
				AMDGPULimit:    &amd,
				NvidiaGPULimit: &nvidia,
			},
		},
	}
}

var kubernetesEnabledSettings = allSettings{
	general: server_settings.ServerSettings{
		ExecutionType: server_settings.ExecutionTypeKubernetes,
		License: server_settings.LicenseStatus{
			LauncherEnabled: true,
		},
	},
}

func (s *CapabilitiesSuite) TestKubernetesRuntimeCPU() {
	a := kubernetesEnabledSettings
	a.scheduler = server_settings.SchedulerSettings{
		CPURequest:    1.0,
		CPULimit:      2.0,
		MaxCPURequest: 3.0,
		MaxCPULimit:   4.0,
	}
	s.NoError(a.checkConfig(makeCpuRequestLimit(1.0, 2.0)))
	s.NoError(a.checkConfig(makeCpuRequestLimit(3.0, 3.0)))
	s.NoError(a.checkConfig(makeCpuRequestLimit(3.0, 0.0)))
	s.ErrorContains(a.checkConfig(makeCpuRequestLimit(-1.0, 2.0)), "cpu-request value cannot be less than 0")
	s.ErrorContains(a.checkConfig(makeCpuRequestLimit(1.0, -2.0)), "cpu-limit value cannot be less than 0")
	s.ErrorContains(a.checkConfig(makeCpuRequestLimit(4.0, 4.0)), "cpu-request value of 4.000000 is higher than configured maximum of 3.000000 on this server")
	s.ErrorContains(a.checkConfig(makeCpuRequestLimit(1.0, 10.0)), "cpu-limit value of 10.000000 is higher than configured maximum of 4.000000 on this server")
	s.ErrorContains(a.checkConfig(makeCpuRequestLimit(3.0, 2.0)), "cpu-request value of 3.000000 is higher than cpu-limit value of 2.000000")
}

func (s *CapabilitiesSuite) TestKubernetesRuntimeNoConfiguredLimits() {
	a := kubernetesEnabledSettings
	a.scheduler = server_settings.SchedulerSettings{
		CPURequest:    1.0,
		CPULimit:      2.0,
		MaxCPURequest: 0.0,
		MaxCPULimit:   0.0,
	}
	s.NoError(a.checkConfig(makeCpuRequestLimit(10.0, 10.0)))
}

func (s *CapabilitiesSuite) TestKubernetesRuntimeMemory() {
	a := kubernetesEnabledSettings
	a.scheduler = server_settings.SchedulerSettings{
		MemoryRequest:    1000,
		MemoryLimit:      2000,
		MaxMemoryRequest: 3000,
		MaxMemoryLimit:   4000,
	}
	s.NoError(a.checkConfig(makeMemoryRequestLimit(1000, 2000)))
	s.NoError(a.checkConfig(makeMemoryRequestLimit(3000, 3000)))
	s.NoError(a.checkConfig(makeMemoryRequestLimit(3000, 0)))
	s.ErrorContains(a.checkConfig(makeMemoryRequestLimit(-1000, 2000)), "memory-request value cannot be less than 0")
	s.ErrorContains(a.checkConfig(makeMemoryRequestLimit(1000, -2000)), "memory-limit value cannot be less than 0")
	s.ErrorContains(a.checkConfig(makeMemoryRequestLimit(4000, 4000)), "memory-request value of 4000 is higher than configured maximum of 3000 on this server")
	s.ErrorContains(a.checkConfig(makeMemoryRequestLimit(1000, 10000)), "memory-limit value of 10000 is higher than configured maximum of 4000 on this server")
	s.ErrorContains(a.checkConfig(makeMemoryRequestLimit(3000, 2000)), "memory-request value of 3000 is higher than memory-limit value of 2000")
}

func (s *CapabilitiesSuite) TestKubernetesGPULimits() {
	a := kubernetesEnabledSettings
	a.scheduler = server_settings.SchedulerSettings{
		MaxAMDGPULimit:    1,
		MaxNvidiaGPULimit: 2,
	}
	s.NoError(a.checkConfig(makeGPURequest(0, 1)))
	s.NoError(a.checkConfig(makeGPURequest(1, 0)))
	s.NoError(a.checkConfig(makeGPURequest(1, 1)))
	s.ErrorContains(a.checkConfig(makeGPURequest(5, 0)), "amd-gpu-limit value of 5 is higher than configured maximum of 1 on this server")
	s.ErrorContains(a.checkConfig(makeGPURequest(0, 5)), "nvidia-gpu-limit value of 5 is higher than configured maximum of 2 on this server")
}
