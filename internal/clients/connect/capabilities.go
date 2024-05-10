package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"strings"

	"github.com/rstudio/connect-client/internal/clients/connect/server_settings"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type allSettings struct {
	base        util.AbsolutePath
	user        UserDTO
	general     server_settings.ServerSettings
	application server_settings.ApplicationSettings
	scheduler   server_settings.SchedulerSettings
	python      server_settings.PyInfo
	r           server_settings.RInfo
	quarto      server_settings.QuartoInfo
}

const requirementsFileMissing = `
can't find the package file (%s) in the project directory.
Create the file, listing the packages your project depends on.
Or scan your project dependencies using the publisher UI or
the 'publisher requirements create' command`

func checkRequirementsFile(base util.AbsolutePath, requirementsFilename string) error {
	packageFile := base.Join(requirementsFilename)
	exists, err := packageFile.Exists()
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf(requirementsFileMissing, requirementsFilename)
	}
	return nil
}

func (c *ConnectClient) CheckCapabilities(base util.AbsolutePath, cfg *config.Config, log logging.Logger) error {
	if cfg.Python != nil {
		err := checkRequirementsFile(base, cfg.Python.PackageFile)
		if err != nil {
			return err
		}
	}
	settings, err := c.getSettings(base, cfg, log)
	if err != nil {
		return err
	}
	return settings.checkConfig(cfg)
}

func (c *ConnectClient) getSettings(base util.AbsolutePath, cfg *config.Config, log logging.Logger) (*allSettings, error) {
	settings := &allSettings{
		base: base,
	}

	err := c.client.Get("/__api__/v1/user", &settings.user, log)
	if err != nil {
		return nil, err
	}
	err = c.client.Get("/__api__/server_settings", &settings.general, log)
	if err != nil {
		return nil, err
	}
	err = c.client.Get("/__api__/server_settings/applications", &settings.application, log)
	if err != nil {
		return nil, err
	}

	schedulerPath := ""
	appMode := AppModeFromType(cfg.Type)
	if !appMode.IsStaticContent() {
		// Scheduler settings don't apply to static content,
		// and the API will err if you try.
		schedulerPath = "/" + string(appMode)
	}
	err = c.client.Get("/__api__/server_settings/scheduler"+schedulerPath, &settings.scheduler, log)
	if err != nil {
		return nil, err
	}
	err = c.client.Get("/__api__/v1/server_settings/python", &settings.python, log)
	if err != nil {
		return nil, err
	}
	err = c.client.Get("/__api__/v1/server_settings/r", &settings.r, log)
	if err != nil {
		return nil, err
	}
	err = c.client.Get("/__api__/v1/server_settings/quarto", &settings.quarto, log)
	if err != nil {
		return nil, err
	}
	return settings, nil
}

var (
	errDescriptionTooLong                = errors.New("the description cannot be longer than 4096 characters")
	errCurrentUserExecutionNotLicensed   = errors.New("run_as_current_user is not licensed on this Connect server")
	errCurrentUserExecutionNotConfigured = errors.New("run_as_current_user is not configured on this Connect server")
	errOnlyAppsCanRACU                   = errors.New("run_as_current_user can only be used with application types, not APIs or reports")
	errAPIsNotLicensed                   = errors.New("API deployment is not licensed on this Connect server")
	errKubernetesNotLicensed             = errors.New("off-host execution with Kubernetes is not licensed on this Connect server")
	errKubernetesNotConfigured           = errors.New("off-host execution with Kubernetes is not configured on this Connect server")
	errImageSelectionNotEnabled          = errors.New("default image selection is not enabled on this Connect server")
	errRuntimeSettingsForStaticContent   = errors.New("runtime settings cannot be applied to static content")
)

func adminError(attr string) error {
	return fmt.Errorf("%s requires administrator privileges", attr)
}

func majorMinorVersion(version string) string {
	return strings.Join(strings.Split(version, ".")[:2], ".")
}

type pythonNotAvailableErr struct {
	Requested string
	Available []string
}

func newPythonNotAvailableErr(requested string, installations []server_settings.PyInstallation) *pythonNotAvailableErr {
	available := make([]string, 0, len(installations))
	for _, inst := range installations {
		available = append(available, inst.Version)
	}
	return &pythonNotAvailableErr{
		Requested: requested,
		Available: available,
	}
}

const pythonNotAvailableCode types.ErrorCode = "pythonNotAvailable"
const pythonNotAvailableMsg = `Python %s is not available on the server.
Consider editing your configuration file to request one of the available versions:
%s.`

func (e *pythonNotAvailableErr) Error() string {
	return fmt.Sprintf(pythonNotAvailableMsg, e.Requested, strings.Join(e.Available, ", "))
}

func (a *allSettings) checkMatchingPython(version string) error {
	if version == "" {
		// This is prevented by version being mandatory in the schema.
		return nil
	}
	requested := majorMinorVersion(version)
	for _, inst := range a.python.Installations {
		if majorMinorVersion(inst.Version) == requested {
			return nil
		}
	}
	return types.NewAgentError(pythonNotAvailableCode,
		newPythonNotAvailableErr(requested, a.python.Installations), nil)
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
		return adminError("service_account_name")
	}

	s := a.scheduler
	if err := checkMaxFloat("cpu_request", k.CPURequest, s.MaxCPURequest); err != nil {
		return err
	}
	if err := checkMaxFloat("cpu_limit", k.CPULimit, s.MaxCPULimit); err != nil {
		return err
	}
	if err := checkMaxInt("memory_request", k.MemoryRequest, s.MaxMemoryRequest); err != nil {
		return err
	}
	if err := checkMaxInt("memory_limit", k.MemoryLimit, s.MaxMemoryLimit); err != nil {
		return err
	}
	if err := checkMaxInt("amd_gpu_limit", k.AMDGPULimit, s.MaxAMDGPULimit); err != nil {
		return err
	}
	if err := checkMaxInt("nvidia_gpu_limit", k.NvidiaGPULimit, s.MaxNvidiaGPULimit); err != nil {
		return err
	}

	// Requests cannot be > limits
	if err := checkMinMaxFloatWithDefaults(
		"cpu_request", k.CPURequest, s.CPURequest,
		"cpu_limit", k.CPULimit, s.CPULimit,
	); err != nil {
		return err
	}
	if err := checkMinMaxIntWithDefaults(
		"memory_request", k.MemoryRequest, s.MemoryRequest,
		"memory_limit", k.MemoryLimit, s.MemoryLimit,
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
	appMode := AppModeFromType(cfg.Type)
	if appMode.IsStaticContent() {
		return errRuntimeSettingsForStaticContent
	}
	s := a.scheduler

	if err := checkMaxInt("max_processes", r.MaxProcesses, int32(s.MaxProcessesLimit)); err != nil {
		return err
	}
	if err := checkMaxInt("min_processes", r.MinProcesses, int32(s.MinProcessesLimit)); err != nil {
		return err
	}
	// min/max values for timeouts are validate by the schema
	if err := checkMinMaxIntWithDefaults(
		"min_processes", r.MinProcesses, int32(s.MinProcesses),
		"max_processes", r.MaxProcesses, int32(s.MaxProcesses),
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
			return adminError("run_as_current_user")
		}
		if !cfg.Type.IsAppContent() {
			return errOnlyAppsCanRACU
		}
	}

	if cfg.Connect.Access.RunAs != "" && !a.user.CanAdmin() {
		return adminError("run_as")
	}
	return nil
}

func (a *allSettings) checkFileExists(filename string, attr string) error {
	if filename == "" {
		return nil
	}
	path := a.base.Join(filename)
	exists, err := path.Exists()
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the file %s specified in %s does not exist", filename, attr)
	}
	return nil
}

func (a *allSettings) checkConfig(cfg *config.Config) error {
	var err error
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
		err = a.checkMatchingPython(cfg.Python.Version)
		if err != nil {
			return err
		}
		err = a.checkFileExists(cfg.Python.PackageFile, "python.package-file")
		if err != nil {
			return err
		}
	}
	if cfg.R != nil {
		err = a.checkFileExists(cfg.R.PackageFile, "r.package-file")
		if err != nil {
			return err
		}
	}
	if cfg.Connect != nil {
		err = a.checkAccess(cfg)
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
