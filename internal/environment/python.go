package environment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type PythonInspector interface {
	InspectPython() (*config.Python, error)
}

type defaultPythonInspector struct {
	executor   executor.Executor
	pathLooker util.PathLooker
	base       util.Path
	pythonPath util.Path
	log        logging.Logger
}

var _ PythonInspector = &defaultPythonInspector{}

func NewPythonInspector(base util.Path, pythonPath util.Path, log logging.Logger) PythonInspector {
	return &defaultPythonInspector{
		executor:   executor.NewExecutor(),
		pathLooker: util.NewPathLooker(),
		base:       base,
		pythonPath: pythonPath,
		log:        log,
	}
}

// InspectPython inspects the specified project directory,
// returning a Python configuration.
// If requirements.txt does not exist, it will be
// created using `pip freeze`.
// The python version (and packages if needed) will
// be determined by the specified pythonExecutable,
// or by `python3` or `python` on $PATH.
func (i *defaultPythonInspector) InspectPython() (*config.Python, error) {
	pythonVersion, err := i.getPythonVersion()
	if err != nil {
		return nil, err
	}
	err = i.warnIfNoRequirementsFile()
	if err != nil {
		return nil, err
	}
	return &config.Python{
		Version:        pythonVersion,
		PackageFile:    "requirements.txt",
		PackageManager: "pip",
	}, nil
}

func (i *defaultPythonInspector) validatePythonExecutable(pythonExecutable string) error {
	args := []string{"--version"}
	_, err := i.executor.RunCommand(pythonExecutable, args, i.log)
	if err != nil {
		return fmt.Errorf("could not run python executable '%s': %w", pythonExecutable, err)
	}
	return nil
}

func (i *defaultPythonInspector) getPythonExecutable() (string, error) {
	if i.pythonPath.Path() != "" {
		// User-provided python executable
		exists, err := i.pythonPath.Exists()
		if err != nil {
			return "", err
		}
		if exists {
			return i.pythonPath.Path(), nil
		}
		return "", fmt.Errorf(
			"cannot find the specified Python executable %s: %w",
			i.pythonPath, fs.ErrNotExist)
	} else {
		// Use whatever is on PATH
		path, err := i.pathLooker.LookPath("python3")
		if err == nil {
			// Ensure the Python is actually runnable. This is especially
			// needed on Windows, where `python3` is (by default)
			// an app execution alias. Also, installing Python from
			// python.org does not disable the built-in app execution aliases.
			err = i.validatePythonExecutable(path)
		}
		if err != nil {
			path, err = i.pathLooker.LookPath("python")
			if err == nil {
				err = i.validatePythonExecutable(path)
			}
		}
		if err != nil {
			return "", err
		}
		return path, nil
	}
}

func (i *defaultPythonInspector) getPythonVersion() (string, error) {
	pythonExecutable, err := i.getPythonExecutable()
	if err != nil {
		return "", err
	}
	i.log.Info("Getting Python version", "python", pythonExecutable)
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, err := i.executor.RunCommand(pythonExecutable, args, i.log)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	i.log.Info("Detected Python", "version", version)
	return version, nil
}

func (i *defaultPythonInspector) warnIfNoRequirementsFile() error {
	requirementsFilename := i.base.Join("requirements.txt")
	exists, err := requirementsFilename.Exists()
	if err != nil {
		return err
	}
	if exists {
		i.log.Info("Using Python packages", "source", requirementsFilename)
	} else {
		i.log.Warn("can't find requirements.txt; you will need to create it")
	}
	return nil
}
