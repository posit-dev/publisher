package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"strings"

	"github.com/rstudio/connect-client/internal/clients/connect/server_settings"
	"github.com/rstudio/connect-client/internal/config"
)

type allSettings struct {
	user        UserDTO
	general     server_settings.ServerSettings
	application server_settings.ApplicationSettings
	scheduler   server_settings.SchedulerSettings
	python      server_settings.PyInfo
	r           server_settings.RInfo
	quarto      server_settings.QuartoInfo
}

func (c *ConnectClient) CheckCapabilities(cfg *config.Config) error {
	settings := &allSettings{}

	err := c.client.Get("/__api__/v1/user", &settings.user)
	if err != nil {
		return err
	}
	err = c.client.Get("/__api__/server_settings", &settings.general)
	if err != nil {
		return err
	}
	err = c.client.Get("/__api__/server_settings/applications", &settings.application)
	if err != nil {
		return err
	}

	schedulerPath := ""
	appMode := AppModeFromType(cfg.Type)
	if appMode.IsWorkerApp() {
		schedulerPath = "/" + string(appMode)
	}
	err = c.client.Get("/__api__/server_settings/scheduler"+schedulerPath, &settings.scheduler)
	if err != nil {
		return err
	}
	err = c.client.Get("/__api__/v1/server_settings/python", &settings.python)
	if err != nil {
		return err
	}
	err = c.client.Get("/__api__/v1/server_settings/r", &settings.r)
	if err != nil {
		return err
	}
	err = c.client.Get("/__api__/v1/server_settings/quarto", &settings.quarto)
	if err != nil {
		return err
	}
	return settings.checkConfig(cfg)
}

var (
	errDescriptionTooLong                = errors.New("the description cannot be longer than 4096 characters")
	errCurrentUserExecutionNotLicensed   = errors.New("run-as-current-user is not licensed on this Connect server")
	errCurrentUserExecutionNotConfigured = errors.New("run-as-current-user is not configured on this Connect server")
	errOnlyAppsCanRACU                   = errors.New("run-as-current-user can only be used with application types, not APIs or reports")
	errAPIsNotLicensed                   = errors.New("API deployment is not licensed on this Connect server")
	errKubernetesNotLicensed             = errors.New("off-host execution with Kubernetes is not licensed on this Connect server")
	errKubernetesNotConfigured           = errors.New("off-host execution with Kubernetes is not configured on this Connect server")
	errImageSelectionNotEnabled          = errors.New("default image selection is not enabled on this Connect server")
)

func adminError(attr string) error {
	return fmt.Errorf("%s requires administrator privileges", attr)
}

func majorMinorVersion(version string) string {
	return strings.Join(strings.Split(version, ".")[:2], ".")
}

func (a *allSettings) checkMatchingPython(version string) error {
	if version == "" {
		// This is prevented by version being mandatory in the schema.
		return nil
	}
	need := majorMinorVersion(version)
	for _, inst := range a.python.Installations {
		if majorMinorVersion(inst.Version) == need {
			return nil
		}
	}
	return fmt.Errorf("python %s is not available on the server", need)
}

func (a *allSettings) checkKubernetes(cfg *config.Config) error {
	k := cfg.Connect.Kubernetes
	if k == nil {
		// No kubernetes config present
		return nil
	}
	if !a.general.License.LauncherEnabled {
		return errKubernetesNotLicensed
	}
	if a.general.ExecutionType != server_settings.ExecutionTypeKubernetes {
		return errKubernetesNotConfigured
	}
	if k.DefaultImageName != "" && !a.general.DefaultImageSelectionEnabled {
		return errImageSelectionNotEnabled
	}
	if k.ServiceAccountName != "" && !a.user.CanAdmin() {
		return adminError("service-account-name")
	}

	s := a.scheduler
	if err := checkMaxFloat("cpu-request", k.CPURequest, s.MaxCPURequest); err != nil {
		return err
	}
	if err := checkMaxFloat("cpu-limit", k.CPULimit, s.MaxCPULimit); err != nil {
		return err
	}
	if err := checkMaxInt("memory-request", k.MemoryRequest, s.MaxMemoryRequest); err != nil {
		return err
	}
	if err := checkMaxInt("memory-limit", k.MemoryLimit, s.MaxMemoryLimit); err != nil {
		return err
	}
	if err := checkMaxInt("amd-gpu-limit", k.AMDGPULimit, s.MaxAMDGPULimit); err != nil {
		return err
	}
	if err := checkMaxInt("nvidia-gpu-limit", k.NvidiaGPULimit, s.MaxNvidiaGPULimit); err != nil {
		return err
	}

	// Requests cannot be > limits
	if err := checkMinMaxFloatWithDefaults(
		"cpu-request", k.CPURequest, s.CPURequest,
		"cpu-limit", k.CPULimit, s.CPULimit,
	); err != nil {
		return err
	}
	if err := checkMinMaxIntWithDefaults(
		"memory-request", k.MemoryRequest, s.MemoryRequest,
		"memory-limit", k.MemoryLimit, s.MemoryLimit,
	); err != nil {
		return err
	}
	return nil
}

func (a *allSettings) checkRuntime(cfg *config.Config) error {
	r := cfg.Connect.Runtime
	if r == nil {
		// No runtime configuration present
		return nil
	}
	s := a.scheduler

	if err := checkMaxInt("max-processes", r.MaxProcesses, int32(s.MaxProcessesLimit)); err != nil {
		return err
	}
	if err := checkMaxInt("min-processes", r.MinProcesses, int32(s.MinProcessesLimit)); err != nil {
		return err
	}
	// min/max values for timeouts are validate by the schema
	if err := checkMinMaxIntWithDefaults(
		"min-processes", r.MinProcesses, int32(s.MinProcesses),
		"max-processes", r.MaxProcesses, int32(s.MaxProcesses),
	); err != nil {
		return err
	}
	return nil
}

func (a *allSettings) checkAccess(cfg *config.Config) error {
	if cfg.Connect.Access == nil {
		// No access configuration present
		return nil
	}
	racu := cfg.Connect.Access.RunAsCurrentUser
	if racu != nil && *racu {
		if !a.general.License.CurrentUserExecution {
			return errCurrentUserExecutionNotLicensed
		}
		if !a.application.RunAsCurrentUser {
			return errCurrentUserExecutionNotConfigured
		}
		if !a.user.CanAdmin() {
			return adminError("run-as-current-user")
		}
		if !cfg.Type.IsAppContent() {
			return errOnlyAppsCanRACU
		}
	}

	if cfg.Connect.Access.RunAs != "" && !a.user.CanAdmin() {
		return adminError("run-as")
	}
	return nil
}

func (a *allSettings) checkConfig(cfg *config.Config) error {
	if cfg.Type.IsAPIContent() {
		if !a.general.License.AllowAPIs {
			return errAPIsNotLicensed
		}
	}
	if len(cfg.Description) > 4096 {
		return errDescriptionTooLong
	}
	// we don't upload thumbnails yet, but when we do, we will check MaximumAppImageSize

	if cfg.Python != nil {
		err := a.checkMatchingPython(cfg.Python.Version)
		if err != nil {
			return err
		}
	}
	if cfg.Connect != nil {
		err := a.checkAccess(cfg)
		if err != nil {
			return err
		}
		err = a.checkRuntime(cfg)
		if err != nil {
			return err
		}
		err = a.checkKubernetes(cfg)
		if err != nil {
			return err
		}
	}
	return nil
}

func checkMaxInt[T int32 | int64](attr string, valuePtr *T, limit T) error {
	if valuePtr == nil {
		return nil
	}
	if limit == 0 {
		return nil
	}
	value := *valuePtr
	if value < 0 {
		return fmt.Errorf("%s value cannot be less than 0", attr)
	} else if value > limit {
		return fmt.Errorf(
			"%s value of %d is higher than configured maximum of %d on this server",
			attr, value, limit)
	}
	return nil
}

func checkMaxFloat(attr string, valuePtr *float64, limit float64) error {
	if valuePtr == nil {
		return nil
	}
	if limit == 0 {
		return nil
	}
	value := *valuePtr
	if value < 0 {
		return fmt.Errorf("%s value cannot be less than 0", attr)
	} else if value > limit {
		return fmt.Errorf(
			"%s value of %f is higher than configured maximum of %f on this server",
			attr, value, limit)
	}
	return nil
}

func checkMinMaxIntWithDefaults[T int32 | int64](
	minAttr string, cfgMin *T, defaultMin T,
	maxAttr string, cfgMax *T, defaultMax T) error {

	minValue := defaultMin
	if cfgMin != nil {
		minValue = *cfgMin
	}
	maxValue := defaultMax
	if cfgMax != nil {
		maxValue = *cfgMax
	}
	if maxValue == 0 {
		// no limit
		return nil
	}
	if minValue > maxValue {
		return fmt.Errorf(
			"%s value of %d is higher than %s value of %d",
			minAttr, minValue, maxAttr, maxValue)
	}
	return nil
}

func checkMinMaxFloatWithDefaults(
	minAttr string, cfgMin *float64, defaultMin float64,
	maxAttr string, cfgMax *float64, defaultMax float64) error {

	minValue := defaultMin
	if cfgMin != nil {
		minValue = *cfgMin
	}
	maxValue := defaultMax
	if cfgMax != nil {
		maxValue = *cfgMax
	}
	if maxValue == 0.0 {
		// no limit
		return nil
	}
	if minValue > maxValue {
		return fmt.Errorf(
			"%s value of %f is higher than %s value of %f",
			minAttr, minValue, maxAttr, maxValue)
	}
	return nil
}
