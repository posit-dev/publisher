package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostInitializeSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestPostInitializeSuite(t *testing.T) {
	suite.Run(t, new(PostInitializeSuite))
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

func (s *PostInitializeSuite) SetupSuite() {
	s.log = logging.New()
	initialize.PythonInspectorFactory = makeMockPythonInspector
}

func (s *PostInitializeSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostInitializeSuite) createAppPy() {
	appPath := s.cwd.Join("app.py")
	err := appPath.WriteFile([]byte(`
		from flask import Flask
		app = Flask(__name__)
		app.run()
	`), 0666)
	s.NoError(err)
}

func (s *PostInitializeSuite) TestPostInitializeDefault() {
	s.createAppPy()
	h := PostInitializeHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader("{}")
	req, err := http.NewRequest("POST", "/api/initialize", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	relPath := filepath.Join(".posit", "publish", "default.toml")
	s.Equal(s.cwd.Join(relPath).String(), res.Path)
	s.Equal(relPath, res.RelPath)

	s.Equal("default", res.Name)
	s.Equal(config.ContentTypePythonFlask, res.Configuration.Type)
	s.Equal(expectedPyConfig, res.Configuration.Python)
}

func (s *PostInitializeSuite) TestPostInitializeNamed() {
	s.createAppPy()
	h := PostInitializeHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"configurationName": "newConfig"}`)
	req, err := http.NewRequest("POST", "/api/configurations", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	relPath := filepath.Join(".posit", "publish", "newConfig.toml")
	s.Equal(s.cwd.Join(relPath).String(), res.Path)
	s.Equal(relPath, res.RelPath)

	s.Equal("newConfig", res.Name)
	s.Equal(config.ContentTypePythonFlask, res.Configuration.Type)
	s.Equal(expectedPyConfig, res.Configuration.Python)
}

func (s *PostInitializeSuite) TestPostInitializeConflict() {
	s.TestPostInitializeNamed()
	h := PostInitializeHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"configurationName": "newConfig"}`)
	req, err := http.NewRequest("POST", "/api/configurations", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}

func (s *PostInitializeSuite) TestPostInitializeInspectionFails() {
	h := PostInitializeHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{}`)
	req, err := http.NewRequest("POST", "/api/configurations", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	relPath := filepath.Join(".posit", "publish", "default.toml")
	s.Equal(s.cwd.Join(relPath).String(), res.Path)
	s.Equal(relPath, res.RelPath)

	s.Equal("default", res.Name)
	expected := config.New()
	expected.Title = s.cwd.Base()
	s.Equal(expected, res.Configuration)
	s.Nil(res.Configuration.Python)
}
