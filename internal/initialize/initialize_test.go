package initialize

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type InitializeSuite struct {
	utiltest.Suite
	cwd util.Path
}

func TestInitializeSuite(t *testing.T) {
	suite.Run(t, new(InitializeSuite))
}

func (s *InitializeSuite) SetupTest() {
	// Restore default factories for each test
	contentDetectorFactory = inspect.NewContentTypeDetector
	pythonInspectorFactory = environment.NewPythonInspector

	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *InitializeSuite) TestInitEmpty() {
	log := logging.New()
	err := Init(s.cwd, "", util.Path{}, log)
	s.ErrorIs(err, inspect.ErrCantDetectContentType)
}

func (s *InitializeSuite) createAppPy() {
	appPath := s.cwd.Join("app.py")
	err := appPath.WriteFile([]byte(`
		from flask import Flask
		app = Flask(__name__)
		app.run()
	`), 0666)
	s.NoError(err)
}

func (s *InitializeSuite) createHTML() {
	appPath := s.cwd.Join("index.html")
	err := appPath.WriteFile([]byte(`
		<html></html>
	`), 0666)
	s.NoError(err)
}

func (s *InitializeSuite) createRequirementsFile() {
	appPath := s.cwd.Join("requirements.txt")
	err := appPath.WriteFile([]byte(`
		numpy
		pandas
	`), 0666)
	s.NoError(err)
}

func (s *InitializeSuite) TestInitInferredType() {
	log := logging.New()
	s.createAppPy()
	pythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		i := &MockPythonInspector{}
		i.On("GetPythonVersion").Return("3.4.5", nil)
		i.On("EnsurePythonRequirementsFile").Return(nil)
		return i
	}
	configName := ""
	err := Init(s.cwd, configName, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypePythonFlask)
	s.Equal("3.4.5", cfg.Python.Version)
}

func (s *InitializeSuite) TestInitExplicitPython() {
	log := logging.New()
	s.createHTML()
	pythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		i := &MockPythonInspector{}
		i.On("GetPythonVersion").Return("3.4.5", nil)
		i.On("EnsurePythonRequirementsFile").Return(nil)
		return i
	}
	configName := ""
	python := util.NewPath("/usr/bin/python", s.cwd.Fs())
	err := Init(s.cwd, configName, python, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypeHTML)
	s.Equal("3.4.5", cfg.Python.Version)
}

func (s *InitializeSuite) TestInitRequirementsFile() {
	log := logging.New()
	s.createHTML()
	s.createRequirementsFile()
	pythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		i := &MockPythonInspector{}
		i.On("GetPythonVersion").Return("3.4.5", nil)
		i.On("EnsurePythonRequirementsFile").Return(nil)
		return i
	}
	configName := ""
	err := Init(s.cwd, configName, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypeHTML)
	s.Equal("3.4.5", cfg.Python.Version)
}

func (s *InitializeSuite) TestInitIfNeededWhenNeeded() {
	log := logging.New()
	s.createAppPy()
	pythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		i := &MockPythonInspector{}
		i.On("GetPythonVersion").Return("3.4.5", nil)
		i.On("EnsurePythonRequirementsFile").Return(nil)
		return i
	}
	configName := ""
	err := InitIfNeeded(s.cwd, configName, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypePythonFlask)
	s.Equal("3.4.5", cfg.Python.Version)
}

func (s *InitializeSuite) TestInitIfNeededWhenNotNeeded() {
	log := logging.New()
	configName := ""
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg := config.New()
	cfg.WriteFile(configPath)

	pythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		return &MockPythonInspector{}
	}
	err := InitIfNeeded(s.cwd, configName, log)
	s.NoError(err)
	newConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg, newConfig)
}

type MockPythonInspector struct {
	mock.Mock
}

func (m *MockPythonInspector) GetPythonVersion() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockPythonInspector) EnsurePythonRequirementsFile() error {
	args := m.Called()
	return args.Error(0)
}
