package initialize

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/inspect/detectors"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type InitializeSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestInitializeSuite(t *testing.T) {
	suite.Run(t, new(InitializeSuite))
}

func (s *InitializeSuite) SetupTest() {
	// Restore default factories for each test
	ContentDetectorFactory = detectors.NewContentTypeDetector
	PythonInspectorFactory = inspect.NewPythonInspector

	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	s.cwd = cwd
	err = cwd.MkdirAll(0700)
	s.NoError(err)
}

func (s *InitializeSuite) TestInitEmpty() {
	// Empty directories can be initialized without error.
	log := logging.New()
	path := s.cwd.Join("My App")
	err := path.Mkdir(0777)
	s.NoError(err)

	cfg, err := Init(path, "", util.Path{}, log)
	s.Nil(err)
	s.Equal(config.ContentTypeUnknown, cfg.Type)
	s.Equal("My App", cfg.Title)

	ignorePath := path.Join(".positignore")
	exists, err := ignorePath.Exists()
	s.NoError(err)
	s.True(exists)
}

func (s *InitializeSuite) TestInitIgnoreExists() {
	// An existing .positignore file is not overwritten.
	log := logging.New()
	path := s.cwd.Join("My App")
	err := path.Mkdir(0777)
	s.NoError(err)

	ignorePath := path.Join(".positignore")
	expectedContents := []byte("ignore-this")
	err = ignorePath.WriteFile(expectedContents, 0666)
	s.NoError(err)

	_, err = Init(path, "", util.Path{}, log)
	s.Nil(err)

	contents, err := ignorePath.ReadFile()
	s.NoError(err)
	s.Equal(expectedContents, contents)
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

var expectedPyConfig = &config.Python{
	Version:        "3.4.5",
	PackageManager: "pip",
	PackageFile:    "requirements.txt",
}

func makeMockPythonInspector(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector {
	pyInspector := inspect.NewMockPythonInspector()
	pyInspector.On("InspectPython").Return(expectedPyConfig, nil)
	return pyInspector
}

func (s *InitializeSuite) TestInitInferredType() {
	log := logging.New()
	s.createAppPy()
	PythonInspectorFactory = makeMockPythonInspector
	configName := ""
	cfg, err := Init(s.cwd, configName, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg2, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(config.ContentTypePythonFlask, cfg.Type)
	s.Equal(expectedPyConfig, cfg.Python)
	s.Equal(cfg, cfg2)
}

func (s *InitializeSuite) TestInitExplicitPython() {
	log := logging.New()
	s.createHTML()
	PythonInspectorFactory = makeMockPythonInspector
	configName := ""
	python := util.NewPath("/usr/bin/python", s.cwd.Fs())
	cfg, err := Init(s.cwd, configName, python, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg2, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypeHTML)
	s.Equal("3.4.5", cfg.Python.Version)
	s.Equal(cfg, cfg2)
}

func (s *InitializeSuite) TestInitRequirementsFile() {
	log := logging.New()
	s.createHTML()
	s.createRequirementsFile()
	PythonInspectorFactory = makeMockPythonInspector
	configName := ""
	cfg, err := Init(s.cwd, configName, util.Path{}, log)
	s.NoError(err)
	configPath := config.GetConfigPath(s.cwd, configName)
	cfg2, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg.Type, config.ContentTypeHTML)
	s.Equal("3.4.5", cfg.Python.Version)
	s.Equal(cfg, cfg2)
}

func (s *InitializeSuite) TestInitIfNeededWhenNeeded() {
	log := logging.New()
	s.createAppPy()
	PythonInspectorFactory = makeMockPythonInspector
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
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	cfg.WriteFile(configPath)

	PythonInspectorFactory = func(util.AbsolutePath, util.Path, logging.Logger) inspect.PythonInspector {
		return &inspect.MockPythonInspector{}
	}
	err := InitIfNeeded(s.cwd, configName, log)
	s.NoError(err)
	newConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal(cfg, newConfig)
}

func (s *InitializeSuite) TestGetPossibleConfigs() {
	log := logging.New()
	s.createAppPy()

	err := s.cwd.Join("index.html").WriteFile([]byte(`<html></html>`), 0666)
	s.NoError(err)

	PythonInspectorFactory = makeMockPythonInspector
	configs, err := GetPossibleConfigs(s.cwd, util.Path{}, log)
	s.NoError(err)

	s.Len(configs, 2)
	s.Equal(config.ContentTypePythonFlask, configs[0].Type)
	s.Equal("app.py", configs[0].Entrypoint)
	s.Equal(expectedPyConfig, configs[0].Python)

	s.Equal(config.ContentTypeHTML, configs[1].Type)
	s.Equal("index.html", configs[1].Entrypoint)
	s.Nil(configs[1].Python)
}
