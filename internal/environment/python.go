package environment

import (
	"bytes"
	"fmt"
	"io/fs"
	"os/exec"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PythonInspector interface {
	GetPythonVersion() (string, error)
	EnsurePythonRequirementsFile() error
}

type defaultPythonInspector struct {
	executor   pythonExecutor
	projectDir util.Path
	pythonPath util.Path
	log        logging.Logger
}

var _ PythonInspector = &defaultPythonInspector{}

type pythonExecutor interface {
	runPythonCommand(pythonExecutable string, args []string) ([]byte, error)
}

type defaultPythonExecutor struct{}

var _ pythonExecutor = &defaultPythonExecutor{}

func (e *defaultPythonExecutor) runPythonCommand(pythonExecutable string, args []string) ([]byte, error) {
	cmd := exec.Command(pythonExecutable, args...)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	err := cmd.Run()
	if err != nil {
		return nil, err
	}
	return stdout.Bytes(), nil
}

func NewPythonInspector(projectDir util.Path, pythonPath util.Path, log logging.Logger) *defaultPythonInspector {
	return &defaultPythonInspector{
		executor:   &defaultPythonExecutor{},
		projectDir: projectDir,
		pythonPath: pythonPath,
		log:        log,
	}
}

func (i *defaultPythonInspector) validatePythonExecutable(pythonExecutable string) error {
	args := []string{"--version"}
	_, err := i.executor.runPythonCommand(pythonExecutable, args)
	return err
}

func (i *defaultPythonInspector) getPythonExecutable(exec util.PathLooker) (string, error) {
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
		path, err := exec.LookPath("python3")
		if err == nil {
			// Ensure the Python is actually runnable. This is especially
			// needed on Windows, where `python3` is (by default)
			// an app execution alias. Also, installing Python from
			// python.org does not disable the built-in app execution aliases.
			err = i.validatePythonExecutable(path)
		}
		if err != nil {
			path, err = exec.LookPath("python")
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

func (i *defaultPythonInspector) GetPythonVersion() (string, error) {
	pythonExecutable, err := i.getPythonExecutable(util.NewPathLooker())
	if err != nil {
		return "", err
	}
	i.log.Info("Running Python", "python", pythonExecutable)
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, err := i.executor.runPythonCommand(pythonExecutable, args)
	if err != nil {
		return "", err
	}
	version := strings.TrimSpace(string(output))
	i.log.Info("Detected Python", "version", version)
	return version, nil
}

func (i *defaultPythonInspector) EnsurePythonRequirementsFile() error {
	requirementsFilename := i.projectDir.Join("requirements.txt")
	exists, err := requirementsFilename.Exists()
	if err != nil {
		return err
	}
	if exists {
		i.log.Info("Using Python packages", "source", requirementsFilename)
		return nil
	}
	pythonExecutable, err := i.getPythonExecutable(util.NewPathLooker())
	if err != nil {
		return err
	}
	i.log.Info("Running Python", "python", pythonExecutable)
	source := fmt.Sprintf("%s -m pip freeze", pythonExecutable)
	i.log.Info("Using Python packages", "source", source)
	args := []string{"-m", "pip", "freeze"}
	out, err := i.executor.runPythonCommand(pythonExecutable, args)
	if err != nil {
		return err
	}
	return requirementsFilename.WriteFile(out, 0666)
}
