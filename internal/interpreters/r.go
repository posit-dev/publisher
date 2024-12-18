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

var NotYetInitialized = types.NewAgentError(types.ErrorRExecNotFound, errors.New("not yet initialized"), nil)
var MissingRError = types.NewAgentError(types.ErrorRExecNotFound, errors.New("unable to detect any R interpreters"), nil)
var InvalidR = types.NewAgentError(types.ErrorRExecNotFound, errors.New("r executable is invalid"), nil)

type RInterpreter interface {
	Init() error

	GetRExecutable() (util.AbsolutePath, error)
	GetRVersion() (string, error)
	GetLockFilePath() (util.RelativePath, bool, error)
	CreateLockfile(util.AbsolutePath) error
}

type defaultRInterpreter struct {
	executor   executor.Executor
	pathLooker util.PathLooker

	base                util.AbsolutePath
	preferredPath       util.Path
	rExecutable         util.AbsolutePath
	version             string
	lockfileRelPath     util.RelativePath
	lockfileExists      bool
	lockfileInitialized bool
	log                 logging.Logger
	initialized         bool
	fs                  afero.Fs
}

var _ RInterpreter = &defaultRInterpreter{}

var NewRInterpreter = RInterpreterFactory

func RInterpreterFactory(base util.AbsolutePath,
	rExecutableParam util.Path, log logging.Logger) RInterpreter {

	return &defaultRInterpreter{
		executor:   executor.NewExecutor(),
		pathLooker: util.NewPathLooker(),

		base:                base,
		preferredPath:       rExecutableParam,
		rExecutable:         util.AbsolutePath{},
		version:             "",
		lockfileRelPath:     util.RelativePath{},
		lockfileExists:      false,
		lockfileInitialized: false,
		log:                 log,
		initialized:         false,
		fs:                  nil,
	}
}

// Initializes the attributes within the defaultRInterpreter structure
//  1. Resolves the path to the rExecutable to be used, with a preference
//     towards the perferredPath, but otherwise, first one on path. If the
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
func (i *defaultRInterpreter) Init() error {
	// entire flow doesn't need to occur to be initialized. Just want to be sure
	// some of it was attempted to run
	i.initialized = true

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
	if !i.initialized {
		return util.AbsolutePath{}, NotYetInitialized
	}
	if i.IsRExecutableValid() {
		return i.rExecutable, nil
	}
	return util.AbsolutePath{}, MissingRError
}

func (i *defaultRInterpreter) GetRVersion() (string, error) {
	if !i.initialized {
		return "", NotYetInitialized
	}
	if i.IsRExecutableValid() {
		return i.version, nil
	}
	return "", MissingRError
}

func (i *defaultRInterpreter) GetLockFilePath() (relativePath util.RelativePath, exists bool, err error) {
	if !i.initialized {
		return util.RelativePath{}, false, NotYetInitialized
	}
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
	return i.initialized && i.rExecutable.Path.String() != "" && i.version != ""
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
		exists, err := i.preferredPath.Exists()
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
			exists, err := tempRPath.Exists()
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
	if !i.initialized {
		return "", NotYetInitialized
	}
	version, err := i.getRVersionFromRExecutable(rExecutable)
	if err != nil {
		i.log.Debug("could not run R executable", "rExecutable", rExecutable, "error", err)
		return "", err
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
	output, stderr, err := i.executor.RunCommand(rExecutable, args, util.AbsolutePath{}, i.log)
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

	lockfileExists, err := lockfilePath.Exists()
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
	args := []string{"-s", "-e", "renv::paths$lockfile()"}
	output, stderr, err := i.executor.RunCommand(rExecutable, args, i.base, i.log)
	if err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			i.log.Warn("Couldn't detect lockfile path from R executable (renv::paths$lockfile()); is renv installed?")
		} else {
			i.log.Warn("Error running R executable", "args", args)
		}
		return util.AbsolutePath{}, err
	}
	lines := strings.SplitN(string(append(output, stderr...)), "\n", -1)
	for _, l := range lines {
		i.log.Info("Parsing line for renv::path output", "l", l)
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
	if !i.initialized {
		return NotYetInitialized
	}

	rExecutable, err := i.GetRExecutable()
	if err != nil {
		return err
	}
	i.log.Info("Creating renv lockfile", "path", lockfilePath.String(), "r", rExecutable)

	err = lockfilePath.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}

	escaped := strings.ReplaceAll(lockfilePath.String(), `\`, `\\`)
	code := fmt.Sprintf(`renv::snapshot(lockfile="%s")`, escaped)
	args := []string{"-s", "-e", code}
	stdout, stderr, err := i.executor.RunCommand(rExecutable.String(), args, i.base, i.log)
	i.log.Debug("renv::snapshot()", "out", string(stdout), "err", string(stderr))
	return err
}
