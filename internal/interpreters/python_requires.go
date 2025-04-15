package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/util"

	"gopkg.in/ini.v1"

	toml "github.com/pelletier/go-toml/v2"
)

type PyProjectPythonRequires struct {
	ProjectPath util.AbsolutePath
}

func NewPyProjectPythonRequires(projectPath util.AbsolutePath) *PyProjectPythonRequires {
	return &PyProjectPythonRequires{
		ProjectPath: projectPath,
	}
}

// Find the python version requested by the project if specified in any of the
// supported metadata files. The order of precedence is:
// 1. .python-version
// 2. pyproject.toml
// 3. setup.cfg
//
// The version specifications are the one defined by PEP 440
// if no version is found, an error is returned.
func (p *PyProjectPythonRequires) GetPythonVersionRequirement() (string, error) {
	if version, err := p.readPythonVersionFile(); err == nil && version != "" {
		return version, nil
	}
	if version, err := p.readPyProjectToml(); err == nil && version != "" {
		return version, nil
	}
	if version, err := p.readSetupCfg(); err == nil && version != "" {
		return version, nil
	}
	return "", errors.New("no python version requirement found")
}

// Read a .python-version file and return the version string.
// the file is a plain text file that contains only the version specification.
func (p *PyProjectPythonRequires) readPythonVersionFile() (string, error) {
	path := p.ProjectPath.Join(".python-version")
	data, err := path.ReadFile()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// Read a pyproject.toml file and return the version string.
// The file is a TOML file that contains a [project] section
// with a requires-python key.
//
// [project]
// requires-python = ">=3.8"
func (p *PyProjectPythonRequires) readPyProjectToml() (string, error) {
	path := p.ProjectPath.Join("pyproject.toml")
	data, err := path.ReadFile()
	if err != nil {
		return "", err
	}

	var tomlData map[string]any
	if err := toml.Unmarshal(data, &tomlData); err != nil {
		return "", err
	}

	// project.requires-python
	if project, ok := tomlData["project"].(map[string]any); ok {
		if req, ok := project["requires-python"]; ok {
			return fmt.Sprintf("%v", req), nil
		}
	}

	return "", nil
}

// Read a setup.cfg file and return the version string.
// The file is an INI file that contains an [options] section
// with a python_requires key.
//
// [options]
// python_requires = ">=3.8"
func (p *PyProjectPythonRequires) readSetupCfg() (string, error) {
	path := p.ProjectPath.Join("setup.cfg")
	if exists, _ := path.Exists(); !exists {
		return "", errors.New("setup.cfg file does not exist")
	}

	cfg, err := ini.Load(path.String())
	if err != nil {
		return "", err
	}

	// options.python_requires
	if section, err := cfg.GetSection("options"); err == nil {
		if key, err := section.GetKey("python_requires"); err == nil {
			return key.String(), nil
		}
	}

	return "", nil
}
