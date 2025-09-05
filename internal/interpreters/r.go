package interpreters

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"github.com/spf13/afero"

	"github.com/posit-dev/publisher/internal/executor"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

const DefaultRenvLockfile = "renv.lock"

var MissingRError = types.NewAgentError(types.ErrorRExecNotFound, errors.New("unable to detect any R interpreters"), nil)

func newInvalidRError(desc string, err error) *types.AgentError {
	errorDesc := fmt.Sprintf("r executable is invalid: %s. Error: %s", desc, err)
	return types.NewAgentError(types.ErrorRExecNotFound, errors.New(errorDesc), nil)
}

type RenvAction = string

const (
	RenvSetup    RenvAction = "renvsetup"
	RenvInit     RenvAction = "renvinit"
	RenvSnapshot RenvAction = "renvsnapshot"
	RenvStatus   RenvAction = "renvstatus"
)

type renvCommandObj struct {
	Action      RenvAction `json:"action"`
	ActionLabel string     `json:"actionLabel"`
	Command     string     `json:"command"`
}

type RInterpreter interface {
	IsRExecutableValid() bool
	GetRExecutable() (util.AbsolutePath, error)
	GetRVersion() (string, error)
	GetLockFilePath() (util.RelativePath, bool, error)
	GetPackageManager() string
	GetPreferredPath() string
	CreateLockfile(util.AbsolutePath) error
	RenvEnvironmentErrorCheck() *types.AgentError
	IsRenvInstalled(rexecPath string) *types.AgentError
	GetRRequires() string
}

type defaultRInterpreter struct {
	cmdExecutor executor.Executor
	pathLooker  util.PathLooker
	existsFunc  util.ExistsFunc

	base                util.AbsolutePath
	preferredPath       util.Path
	rExecutable         util.AbsolutePath
	version             string
	lockfileRelPath     util.RelativePath
	lockfileExists      bool
	lockfileInitialized bool
	log                 logging.Logger
	fs                  afero.Fs
}

type RInterpreterFactory func(
	base util.AbsolutePath,
	rExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (RInterpreter, error)

var _ RInterpreter = &defaultRInterpreter{}

func NewRInterpreter(
	base util.AbsolutePath,
	rExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (RInterpreter, error) {
	interpreter := &defaultRInterpreter{
		cmdExecutor: nil,
		pathLooker:  nil,
		existsFunc:  nil,

		base:                base,
		preferredPath:       rExecutableParam,
		rExecutable:         util.AbsolutePath{},
		version:             "",
		lockfileRelPath:     util.RelativePath{},
		lockfileExists:      false,
		lockfileInitialized: false,
		log:                 log,
		fs:                  nil,
	}
	if cmdExecutorOverride != nil {
		interpreter.cmdExecutor = cmdExecutorOverride
	} else {
		interpreter.cmdExecutor = executor.NewExecutor()
	}
	if pathLookerOverride != nil {
		interpreter.pathLooker = pathLookerOverride
	} else {
		interpreter.pathLooker = util.NewPathLooker()
	}
	if existsFuncOverride != nil {
		interpreter.existsFunc = existsFuncOverride
	} else {
		interpreter.existsFunc = func(p util.Path) (bool, error) {
			return p.Exists()
		}
	}

	err := interpreter.init()
	if err != nil {
		return nil, err
	}
	return interpreter, nil
}

// Initializes the attributes within the defaultRInterpreter structure
//  1. Resolves the path to the rExecutable to be used, with a preference
//     towards the preferredPath, but otherwise, first one on path. If the
//     executable is not a valid R interpreter, then will not be set.
//  2. Seeds the version of the rExecutable being used, if set.
//
// We lazy load the lock file information, since it requires a call into
// renv, which can be slow to be started (package initialization or something).
// When this occurs, we'll do the following steps.
//  3. Seeds the renv lock file for the rExecutable being used or if not found
//     then the path to the default lock file
//  4. Seeds the existance of the lock file at the lockfileRelPath
//
// Errors are taken care of internally and determine the setting or non-setting
// of the attributes.
func (i *defaultRInterpreter) init() error {
	// This will set the rExecutable and version for us
	// Only fatal, unexpected errors will be returned.
	// We will handle MissingRError internally, as this is a valid environment
	err := i.resolveRExecutable()
	if err != nil {
		if _, ok := types.IsAgentErrorOf(err, types.ErrorRExecNotFound); ok {
			// suppress the error, this is valid.
			return nil
		}
		return err
	}

	return nil
}

func (i *defaultRInterpreter) GetRExecutable() (util.AbsolutePath, error) {
	if i.IsRExecutableValid() {
		return i.rExecutable, nil
	}
	return i.rExecutable, MissingRError
}

func (i *defaultRInterpreter) GetRVersion() (string, error) {
	if i.IsRExecutableValid() {
		return i.version, nil
	}
	return "", MissingRError
}

func (i *defaultRInterpreter) GetLockFilePath() (relativePath util.RelativePath, exists bool, err error) {
	if !i.lockfileInitialized {
		// This will set lockfileRelPath and lockfileExists for us
		// and does not require an R Executable to be available (but it is better if it is)
		err = i.resolveRenvLockFile(i.rExecutable.String())
		if err != nil {
			return util.RelativePath{}, false, err
		}
		i.lockfileInitialized = true
	}
	return i.lockfileRelPath, i.lockfileExists, nil
}

func (i *defaultRInterpreter) IsRExecutableValid() bool {
	return i.rExecutable.Path.String() != "" && i.version != ""
}

func (i *defaultRInterpreter) RenvEnvironmentErrorCheck() *types.AgentError {
	rExec, err := i.GetRExecutable()
	if err != nil {
		i.log.Error("Could not get an R executable while determining if renv is installed", "error", err.Error())
		return i.cannotVerifyRenvErr(err)
	}

	aerr := i.IsRenvInstalled(rExec.String())
	if aerr != nil {
		return aerr
	}

	renvStatusOutput, aerr := i.renvStatus(rExec.String())
	if aerr != nil {
		return aerr
	}

	return i.prepRenvActionCommand(rExec.String(), renvStatusOutput)
}

func (i *defaultRInterpreter) IsRenvInstalled(rexecPath string) *types.AgentError {
	output, _, err := i.cmdExecutor.RunScript(rexecPath, []string{"-s"}, "cat(system.file(package = \"renv\"))", i.base, i.log)
	if err != nil {
		i.log.Error("Unable to determine if renv is installed", "error", err.Error())
		return types.NewAgentError(
			types.ErrorUnknown,
			errors.Join(
				errors.New("unable to determine if renv is installed"),
				err,
			),
			nil)
	}

	// If renv package is not installed, prep and send the terminal command that'll help the user
	renvLibFile := string(output)
	if renvLibFile == "" {
		return types.NewAgentError(
			types.ErrorRenvPackageNotInstalled,
			errors.New("package renv is not installed. An renv lockfile is needed for deployment"),
			renvCommandObj{
				Action:      RenvSetup,
				ActionLabel: "Setup renv",
				Command:     fmt.Sprintf(`%s -s -e "install.packages(\"renv\"); renv::init();"`, rexecPath),
			})
	}

	return nil
}

func (i *defaultRInterpreter) renvStatus(rexecPath string) (string, *types.AgentError) {
	output, _, err := i.cmdExecutor.RunScript(rexecPath, []string{"-s"}, "renv::status()", i.base, i.log)
	if err != nil {
		i.log.Error("Error attempting to run renv::status()", "error", err.Error())
		return "", types.NewAgentError(
			types.ErrorUnknown,
			errors.Join(
				errors.New("error attempting to run renv::status()"),
				err,
			),
			nil)
	}

	return string(output), nil
}

func (i *defaultRInterpreter) prepRenvActionCommand(rexecPath string, renvStatus string) *types.AgentError {
	// The default command suggested is renv::status()
	renvDescError := errors.New("the renv environment for this project is not in a healthy state. Run renv::status() for more details")
	commandObj := renvCommandObj{
		Action:      RenvStatus,
		ActionLabel: "Run and show renv::status()",
		Command:     fmt.Sprintf(`%s -s -e "renv::status()"`, rexecPath),
	}

	if strings.Contains(renvStatus, "renv::init()") {
		// Renv suggests to init() the project
		renvDescError = errors.New(`project requires renv initialization "renv::init()" to be deployed`)
		commandObj.Action = RenvInit
		commandObj.ActionLabel = "Setup renv"
		commandObj.Command = fmt.Sprintf(`%s -s -e "renv::init()"`, rexecPath)
	} else if strings.Contains(renvStatus, "renv::snapshot()") {
		// Renv suggests to snapshot(), only the lockfile is missing
		renvDescError = errors.New(`project requires renv to update the lockfile to be deployed`)
		commandObj.Action = RenvSnapshot
		commandObj.ActionLabel = "Setup lockfile"
		commandObj.Command = fmt.Sprintf(`%s -s -e "renv::snapshot()"`, rexecPath)
	}

	return types.NewAgentError(
		types.ErrorRenvActionRequired,
		renvDescError,
		commandObj)
}

func (i *defaultRInterpreter) cannotVerifyRenvErr(err error) *types.AgentError {
	if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
		return aerr
	}
	verifyErr := types.NewAgentError(types.ErrorUnknown, err, nil)
	verifyErr.Message = "Unable to determine if renv is installed"
	return verifyErr
}

// Determine which R Executable to use by:
//  1. If provided by user, (This is used to pass in selected versions from Positron and Extensions,
//     as well as from CLI).
//  2. If not provided, then identify first R interpreter on PATH.
//
// Will fail if R executable does not physically exist or is not executable
// If successful, this will update to the rExecutable and its associated version within
// the defaultRInterpreter struct
func (i *defaultRInterpreter) resolveRExecutable() error {
	var rExecutable = util.AbsolutePath{}

	// Passed in path to executable
	if i.preferredPath.String() != "" {
		// User-provided R executable
		exists, err := i.existsFunc(i.preferredPath)
		if err != nil {
			i.log.Warn("Unable to check existence of preferred R interpreter. Proceeding with discovery.", "preferredPath", i.preferredPath, "error", err)
		} else {
			if exists {
				rExecutable = util.NewAbsolutePath(i.preferredPath.String(), i.fs)
			} else {
				i.log.Warn("Preferred R interpreter does not exist. Proceeding with discovery.", "preferredPath", i.preferredPath)
			}
		}
	}

	// If we don't have one yet...
	if rExecutable.Path.String() == "" {
		// Find the executable on PATH
		var path string
		var err error

		i.log.Debug("Looking for R on PATH", "PATH", os.Getenv("PATH"))
		path, err = i.pathLooker.LookPath("R")
		if err == nil {
			i.log.Debug("Found R executable from PATH", "path", path)
			tempRPath := util.NewPath(path, i.fs)
			// make sure it exists
			exists, err := i.existsFunc(tempRPath)
			if err != nil {
				i.log.Warn("Unable to check existence of R interpreter on PATH. Proceeding with discovery.", "path", path, "error", err)
			} else {
				if exists {
					rExecutable = util.NewAbsolutePath(tempRPath.String(), i.fs)
				} else {
					i.log.Warn("R interpreter on PATH does not exist. Proceeding with discovery.", "path", path)
				}
			}
		} else {
			if errors.Is(err, exec.ErrNotFound) {
				i.log.Debug("R executable not found on PATH. Proceeding with discovery.")
			} else {
				i.log.Debug("Unable to search path for R executable", "error", err)
			}
		}
	}

	// If we still don't have one, then it will need
	// to be handled, but is a totally valid environment without R
	if rExecutable.Path.String() == "" {
		i.log.Debug("R executable not found, proceeding without working R environment.")
		return MissingRError
	}

	// Need to validate the executable, so let's ask it for the version
	i.log.Debug("Validating path to R executable found", "path", rExecutable)
	// Ensure the R is actually runnable.
	version, err := i.ValidateRExecutable(rExecutable.String())
	if err == nil {
		i.log.Debug("Successful validation for R executable", "rExecutable", rExecutable)
	} else {
		i.log.Debug("R executable from PATH is invalid.", "rExecutable", rExecutable, "error", err)
		return err
	}

	// all is good!
	i.rExecutable = util.NewAbsolutePath(rExecutable.String(), i.fs)
	i.version = version
	return nil
}

// We assume if we can get a version from the rExecutable passed in, that it
// is really an R Executable.
func (i *defaultRInterpreter) ValidateRExecutable(rExecutable string) (string, error) {
	version, err := i.getRVersionFromRExecutable(rExecutable)
	if err != nil {
		desc := fmt.Sprintf("could not run R executable. rExecutable: %s", rExecutable)
		i.log.Error(desc, "error", err)
		aerr := newInvalidRError(desc, err)
		return "", aerr
	}
	return version, nil
}

// Retrieve the version of R from the rExecutable passed in
// This function searches the output for a very specific text pattern (see the regex `rVersionRE`)
// and only returns the version if found in that way. This allows us to confirm it is an R interpreter
// versus any other executable which might return a version.
func (i *defaultRInterpreter) getRVersionFromRExecutable(rExecutable string) (string, error) {
	var rVersionRE = regexp.MustCompile(`^R version (\d+\.\d+\.\d+)`)

	i.log.Info("Getting R version", "r", rExecutable)
	args := []string{"--version"}
	output, stderr, err := i.cmdExecutor.RunCommand(rExecutable, args, util.AbsolutePath{}, i.log)
	if err != nil {
		return "", err
	}
	lines := strings.SplitN(string(append(output, stderr...)), "\n", -1)
	for _, l := range lines {
		i.log.Info("Parsing line for R version", "l", l)
		m := rVersionRE.FindStringSubmatch(l)
		if len(m) < 2 {
			continue
		}
		version := m[1]
		i.log.Info("Detected R version", "version", version)
		return version, nil
	}
	return "", fmt.Errorf("couldn't parse R version from command output (%s --version)", rExecutable)
}

// Determine if the configured (or not configured) renv lock file exists
// by falling through a specific search criteria
// 1. Does the R executable indicate a renv lock file path?
// 2. Use the default lock file path
// 3. Does the lock file exist
//
// Return path, existence and any error if encountered.
func (i *defaultRInterpreter) resolveRenvLockFile(rExecutable string) error {
	var lockfilePath util.AbsolutePath
	var err error

	if i.IsRExecutableValid() {
		lockfilePath, err = i.getRenvLockfilePathFromRExecutable(rExecutable)
		if err == nil {
			i.log.Debug("renv lockfile found via R executable", "renv_lock", lockfilePath)
		} else {
			// we'll handle the error by looking elsewhere
			i.log.Debug("Unable to get renv lockfile path via R executable", "error", err.Error())
		}
	}
	// if we still don't have a path, we'll default if we can't get it from R executable
	if lockfilePath.Path.String() == "" {
		lockfilePath = i.base.Join(DefaultRenvLockfile)
		i.log.Debug("looking for default renv lockfile", "lockfilePath", lockfilePath)
	}

	lockfileRelPath, err := lockfilePath.Rel(i.base)
	if err != nil {
		i.log.Debug("Error getting relative path for renv lockfile", "basepath", i.base.String(), "error", err.Error())
		return err
	}

	lockfileExists, err := i.existsFunc(lockfilePath.Path)
	if err != nil {
		i.log.Debug("Error while confirming existence of renv lock file", "renv_lock", lockfilePath, "error", err.Error())
		return err
	}

	i.lockfileRelPath = lockfileRelPath
	i.lockfileExists = lockfileExists
	return nil
}

// Determine the renv lock file as configured. (renv::init() allows for different file names for lock file)
// We can get the renv lockfile path from the active R executable
// If we can't then we return an error. Using default is responsibility of caller
// NOTE: Do not need to be initialized for this functionality, since it operates on external rExecutable
func (i *defaultRInterpreter) getRenvLockfilePathFromRExecutable(rExecutable string) (util.AbsolutePath, error) {
	var renvLockRE = regexp.MustCompile(`^\[1\] "(.*)"`)

	i.log.Info("Getting renv lockfile path from R executable", "r", rExecutable)
	cmd := "renv::paths$lockfile()"
	output, stderr, err := i.cmdExecutor.RunScript(rExecutable, []string{"-s"}, cmd, i.base, i.log)
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			i.log.Warn("Couldn't detect lockfile path from R executable (renv::paths$lockfile()); is renv installed?")
		} else {
			i.log.Warn("Error running R executable", "script", "renv::paths$lockfile()")
		}
		return util.AbsolutePath{}, err
	}
	lines := strings.SplitN(string(append(output, stderr...)), "\n", -1)
	for _, l := range lines {
		i.log.Info("Parsing line for renv::path output", "output", l)
		m := renvLockRE.FindStringSubmatch(l)
		if len(m) < 2 {
			continue
		}
		// paths$lockfile returns an absolute path
		path := m[1]
		i.log.Info("renv::paths$lockfile returned lockfile path", "path", path)
		return util.NewAbsolutePath(path, i.fs), nil
	}
	i.log.Warn("couldn't parse renv lockfile path from renv::paths$lockfile", "output", output)
	return util.AbsolutePath{}, errors.New("couldn't parse renv lockfile path from renv::paths$lockfile")
}

// CreateLockfile creates a lockfile at the specified path
// by invoking R to run `renv::snapshot()`.
func (i *defaultRInterpreter) CreateLockfile(lockfilePath util.AbsolutePath) error {
	rExecutable, err := i.GetRExecutable()
	if err != nil {
		return err
	}
	i.log.Info("Creating renv lockfile", "path", lockfilePath.String(), "r", rExecutable)

	err = lockfilePath.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	var cmd string
	if lockfilePath.String() == "" {
		cmd = "renv::snapshot()"
	} else {
		escaped := strings.ReplaceAll(lockfilePath.String(), `\`, `\\`)
		cmd = fmt.Sprintf(`renv::snapshot(lockfile="%s")`, escaped)
	}
	stdout, stderr, err := i.cmdExecutor.RunScript(rExecutable.String(), []string{"-s"}, cmd, i.base, i.log)
	i.log.Debug("renv::snapshot()", "out", string(stdout), "err", string(stderr))
	return err
}

func (i *defaultRInterpreter) GetPackageManager() string {
	return "renv"
}

func (i *defaultRInterpreter) GetPreferredPath() string {
	return i.preferredPath.String()
}

func (i *defaultRInterpreter) GetRRequires() string {
	rProjectRequires := NewRProjectRRequires(i.base)
	rRequires, err := rProjectRequires.GetRVersionRequirement()
	if err != nil {
		i.log.Warn("Error retrieving required R version", "error", err.Error())
		rRequires = ""
	}
	return rRequires
}
