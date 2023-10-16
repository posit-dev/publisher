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
	GetPythonRequirements() ([]byte, error)
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
		if err != nil {
			return exec.LookPath("python")
		}
		return path, err
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

func (i *defaultPythonInspector) GetPythonRequirements() ([]byte, error) {
	requirementsFilename := i.projectDir.Join("requirements.txt")
	exists, err := requirementsFilename.Exists()
	if err != nil {
		return nil, err
	}
	if exists {
		i.log.Info("Using Python packages", "source", requirementsFilename)
		return requirementsFilename.ReadFile()
	}
	pythonExecutable, err := i.getPythonExecutable(util.NewPathLooker())
	if err != nil {
		return nil, err
	}
	i.log.Info("Running Python", "python", pythonExecutable)
	source := fmt.Sprintf("'%s -m pip freeze'", pythonExecutable)
	i.log.Info("Using Python packages", "source", source)
	args := []string{"-m", "pip", "freeze"}
	return i.executor.runPythonCommand(pythonExecutable, args)
}
