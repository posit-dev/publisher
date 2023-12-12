package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/environment/environmenttest"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostConfigurationsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestPostConfigurationsSuite(t *testing.T) {
	suite.Run(t, new(PostConfigurationsSuite))
}

func (s *PostConfigurationsSuite) SetupSuite() {
	s.log = logging.New()
	initialize.PythonInspectorFactory = func(util.Path, util.Path, logging.Logger) environment.PythonInspector {
		i := &environmenttest.MockPythonInspector{}
		i.On("GetPythonVersion").Return("3.4.5", nil)
		i.On("EnsurePythonRequirementsFile").Return(nil)
		return i
	}
}

func (s *PostConfigurationsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostConfigurationsSuite) createAppPy() {
	appPath := s.cwd.Join("app.py")
	err := appPath.WriteFile([]byte(`
		from flask import Flask
		app = Flask(__name__)
		app.run()
	`), 0666)
	s.NoError(err)
}

func (s *PostConfigurationsSuite) TestPostConfigurationsDefault() {
	s.createAppPy()
	h := PostConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader("{}")
	req, err := http.NewRequest("POST", "/api/configurations", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	actualPath, err := util.NewPath(res.Path, s.cwd.Fs()).Rel(s.cwd)
	s.NoError(err)
	s.Equal("default", res.Name)
	s.Equal(".posit/publish/default.toml", actualPath.String())
	s.Equal(config.ContentTypePythonFlask, res.Configuration.Type)
}

func (s *PostConfigurationsSuite) TestPostConfigurationsNamed() {
	s.createAppPy()
	h := PostConfigurationsHandlerFunc(s.cwd, s.log)

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

	actualPath, err := util.NewPath(res.Path, s.cwd.Fs()).Rel(s.cwd)
	s.NoError(err)
	s.Equal("newConfig", res.Name)
	s.Equal(".posit/publish/newConfig.toml", actualPath.String())
	s.Equal(config.ContentTypePythonFlask, res.Configuration.Type)
}

func (s *PostConfigurationsSuite) TestPostConfigurationsConflict() {
	s.TestPostConfigurationsNamed()
	h := PostConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"configurationName": "newConfig"}`)
	req, err := http.NewRequest("POST", "/api/configurations", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}

func (s *PostConfigurationsSuite) TestPostConfigurationsInspectionFails() {
	h := PostConfigurationsHandlerFunc(s.cwd, s.log)

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

	actualPath, err := util.NewPath(res.Path, s.cwd.Fs()).Rel(s.cwd)
	s.NoError(err)
	s.Equal("default", res.Name)
	s.Equal(".posit/publish/default.toml", actualPath.String())
	s.Equal(config.New(), res.Configuration)
}
