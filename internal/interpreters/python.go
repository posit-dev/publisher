package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
)

var MissingPythonError = types.NewAgentError(types.ErrorPythonExecNotFound, errors.New("unable to detect any Python interpreters"), nil)
var pythonVersionCache = make(map[string]string)

var userHomeDir = os.UserHomeDir

type PythonInterpreter interface {
	IsPythonExecutableValid() bool
	GetPythonExecutable() (util.AbsolutePath, error)
	GetLockFilePath() (util.RelativePath, bool, error)
	GetPythonVersion() (string, error)
	GetPackageManager() string
	GetPreferredPath() string
	GetPythonRequires() string
}

type defaultPythonInterpreter struct {
	cmdExecutor executor.Executor
	pathLooker  util.PathLooker
	existsFunc  util.ExistsFunc

	base             util.AbsolutePath
	preferredPath    util.Path
	pythonExecutable util.AbsolutePath
	version          string
	lockfileRelPath  util.RelativePath
	log              logging.Logger
	fs               afero.Fs
}

type PythonInterpreterFactory func(
	base util.AbsolutePath,
	pythonExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (PythonInterpreter, error)

var _ PythonInterpreter = &defaultPythonInterpreter{}

const PythonRequirementsFilename = "requirements.txt"

func NewPythonInterpreter(
	base util.AbsolutePath,
	pythonExecutableParam util.Path,
	log logging.Logger,
	cmdExecutorOverride executor.Executor,
	pathLookerOverride util.PathLooker,
	existsFuncOverride util.ExistsFunc,
) (PythonInterpreter, error) {
	interpreter := &defaultPythonInterpreter{
		cmdExecutor: nil,
		pathLooker:  nil,
		existsFunc:  nil,

		base:             base,
		preferredPath:    pythonExecutableParam,
		pythonExecutable: util.AbsolutePath{},
		version:          "",
		lockfileRelPath:  util.RelativePath{},
		log:              log,
		fs:               nil,
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

// Initializes the attributes within the defaultPythonInterpreter structure
//  1. Resolves the path to the pythonExecutable to be used, with a preference
//     towards the preferredPath, but otherwise, first one on path. If the
//     executable is not a valid Python interpreter, then will not be set.
//  2. Seeds the version of the pythonExecutable being used, if set.
//
// Errors are taken care of internally and determine the setting or non-setting
// of the attributes.
func (i *defaultPythonInterpreter) init() error {
	// This will set the pythonExecutable and version for us
	// Only fatal, unexpected errors will be returned.
	// We will handle MissingPythonError internally, as this is a valid environment
	err := i.resolvePythonExecutable()
	if err != nil {
		if _, ok := types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound); ok {
			// suppress the error, this is valid.
			return nil
		}
		return err
	}

	return nil
}

// Determine which Python Executable to use by:
//  1. If provided by user, (This is used to pass in selected versions from Positron and Extensions,
//     as well as from CLI).
//  2. If not provided, then identify first Python interpreter on PATH.
//
// Will fail if Python executable does not physically exist or is not executable
// If successful, this will update to the pythonExecutable and its associated version within
// the defaultPythonInterpreter struct
func (i *defaultPythonInterpreter) resolvePythonExecutable() error {
	executableNames := []string{"python3", "python"}

	// Important to normalize the preferredPath before we use it
	i.normalizeExecutable()

	rawPath := i.preferredPath.String()
	pythonPath := ""
	version := ""

	// Passed in path to executable
	if rawPath != "" {
		if strings.ContainsRune(rawPath, os.PathSeparator) {
			// User-provided python executable
			exists, err := i.existsFunc(i.preferredPath)
			if err == nil {
				if exists {
					version, err = i.validatePythonExecutable(rawPath)
					if err == nil {
						i.log.Debug("Successful validation for Python executable", "pythonExecutable", pythonPath, "version", version)
						i.pythonExecutable = util.NewAbsolutePath(rawPath, i.fs)
						i.version = version
						return nil
					}
					i.log.Warn("Preferred Python interpreter is not valid. Proceeding with discovery.", "preferredPath", rawPath)
				} else {
					i.log.Warn("Preferred Python interpreter does not exist. Proceeding with discovery.", "preferredPath", rawPath)
				}
			} else {
				i.log.Warn("Error checking existence of passed in path. Continuing discovery.", rawPath, err)
			}
		} else {
			// Only the interpreter name was specified; look for it on PATH.
			executableNames = append([]string{rawPath}, executableNames...)
		}
	}

	// Find the executable on PATH
	var path string
	var err error

	i.log.Info("Looking for Python on PATH", "PATH", os.Getenv("PATH"))
	for _, executableName := range executableNames {
		path, err = i.pathLooker.LookPath(executableName)
		if err == nil {
			// Ensure the Python is actually runnable. This is especially
			// needed on Windows, where `python3` is (by default)
			// an app execution alias. Also, installing Python from
			// python.org does not disable the built-in app execution aliases.
			version, err = i.validatePythonExecutable(path)
			if err == nil {
				i.log.Debug("Successful validation for Python executable", "pythonExecutable", path, "version", version)
				i.pythonExecutable = util.NewAbsolutePath(path, i.fs)
				i.version = version
				return nil
			}
			i.log.Warn("Discovered Python interpreter is not valid. Proceeding with discovery.", "path", executableName)
		}
	}
	i.log.Debug("Python executable not found, proceeding without working Python environment.")
	return types.NewAgentError(types.ErrorPythonExecNotFound, err, nil)
}

// Normalize the preferredPath by expanding ~ to home directory
func (i *defaultPythonInterpreter) normalizeExecutable() error {
	// Paths like ~/bin/python should be expanded to /home/user/bin/python
	// before we try to use them.
	// This to solve some issues for inconsistent shell behavior.
	if strings.Contains(i.preferredPath.String(), "~") {
		homeDir, err := userHomeDir()
		if err != nil {
			return fmt.Errorf("error getting home directory to normalize python preferred path: '%s': %w", i.preferredPath.String(), err)
		}
		i.preferredPath = util.NewPath(strings.Replace(i.preferredPath.String(), "~", homeDir, 1), i.fs)
	}
	return nil
}

func (i *defaultPythonInterpreter) validatePythonExecutable(pythonExecutable string) (string, error) {
	version, err := i.getPythonVersion(pythonExecutable)
	if err != nil {
		return version, fmt.Errorf("could not run python executable '%s': %w", pythonExecutable, err)
	}
	return version, nil
}

func (i *defaultPythonInterpreter) getPythonVersion(pythonExecutable string) (string, error) {
	if version, ok := pythonVersionCache[pythonExecutable]; ok {
		return version, nil
	}
	i.log.Info("Getting Python version", "python", pythonExecutable)
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, _, err := i.cmdExecutor.RunCommand(pythonExecutable, args, i.base, i.log)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	i.log.Info("Detected Python", "version", version)

	// Cache interpreter version result, unless it's a pyenv shim
	// (where the real Python interpreter may vary from run to run)
	if !strings.Contains(pythonExecutable, "shims") {
		pythonVersionCache[pythonExecutable] = version
	}
	return version, nil
}

func (i *defaultPythonInterpreter) GetPythonExecutable() (util.AbsolutePath, error) {
	if i.IsPythonExecutableValid() {
		return i.pythonExecutable, nil
	}
	return i.pythonExecutable, MissingPythonError
}

func (i *defaultPythonInterpreter) GetPythonVersion() (string, error) {
	if i.IsPythonExecutableValid() {
		return i.version, nil
	}
	return "", MissingPythonError
}

func (i *defaultPythonInterpreter) IsPythonExecutableValid() bool {
	return i.pythonExecutable.String() != "" && i.version != ""
}

func (i *defaultPythonInterpreter) GetPackageManager() string {
	return "auto"
}

func (i *defaultPythonInterpreter) GetPreferredPath() string {
	return i.preferredPath.String()
}

func (i *defaultPythonInterpreter) GetLockFilePath() (util.RelativePath, bool, error) {
	lockFile := "requirements.txt"
	lockFileAbsPath := i.base.Join(lockFile)
	exists, err := i.existsFunc(lockFileAbsPath.Path)
	return util.NewRelativePath(lockFile, i.fs), exists, err
}

func (i *defaultPythonInterpreter) GetPythonRequires() string {
	pyProjectRequires := NewPyProjectPythonRequires(i.base)
	python_requires, err := pyProjectRequires.GetPythonVersionRequirement()
	if err != nil {
		i.log.Warn("Error retrieving Python requires", "error", err.Error())
		python_requires = ""
	}
	return python_requires
}
