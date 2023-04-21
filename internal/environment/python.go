package environment

import (
	"bytes"
	"os/exec"
	"path/filepath"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PythonInspector interface {
	GetPythonVersion() (string, error)
	GetPythonRequirements() ([]byte, error)
}

type defaultPythonInspector struct {
	executor      pythonExecutor
	fs            afero.Fs
	projectPath   string
	pythonPath    string
	pythonVersion string
	logger        rslog.Logger
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

func NewPythonInspector(fs afero.Fs, projectPath string, pythonPath string, pythonVersion string, logger rslog.Logger) *defaultPythonInspector {
	return &defaultPythonInspector{
		executor:      &defaultPythonExecutor{},
		fs:            fs,
		projectPath:   projectPath,
		pythonPath:    pythonPath,
		pythonVersion: pythonVersion,
		logger:        logger,
	}
}

func (i *defaultPythonInspector) getPythonExecutable() string {
	if i.pythonPath != "" {
		// User-provided python executable
		return i.pythonPath
	} else {
		// Use whatever is on PATH
		return "python3"
	}
}

func (i *defaultPythonInspector) GetPythonVersion() (string, error) {
	if i.pythonVersion != "" {
		// User-provided version
		return i.pythonVersion, nil
	}
	pythonExecutable := i.getPythonExecutable()
	args := []string{
		`-E`, // ignore python-specific environment variables
		`-c`, // execute the next argument as python code
		`import sys; v = sys.version_info; print("%d.%d.%d" % (v[0], v[1], v[2]))`,
	}
	output, err := i.executor.runPythonCommand(pythonExecutable, args)
	if err != nil {
		return "", err
	}
	version := string(output)
	i.logger.Infof("Found Python version %s", version)
	return version, nil
}

func (i *defaultPythonInspector) GetPythonRequirements() ([]byte, error) {
	requirementsFilename := filepath.Join(i.projectPath, "requirements.txt")
	exists, err := afero.Exists(i.fs, requirementsFilename)
	if err != nil {
		return nil, err
	}
	if exists {
		i.logger.Infof("Using Python packages from %s", requirementsFilename)
		return afero.ReadFile(i.fs, requirementsFilename)
	}
	pythonExecutable := i.getPythonExecutable()
	args := []string{"-m", "pip", "freeze"}
	return i.executor.runPythonCommand(pythonExecutable, args)
}
