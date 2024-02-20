package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostConfigurationSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestPostConfigurationSuite(t *testing.T) {
	suite.Run(t, new(PostConfigurationSuite))
}

func (s *PostConfigurationSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostConfigurationSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostConfigurationSuite) TestPostConfiguration() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{
		"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		"type": "python-shiny",
		"entrypoint": "app.py"
	}`))

	handler := PostConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Error)
	s.NotNil(responseBody.Configuration)
	s.Equal(config.ContentTypePythonShiny, responseBody.Configuration.Type)
}

func (s *PostConfigurationSuite) TestPostConfigurationBadConfig() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	req.Body = io.NopCloser(strings.NewReader(`{"type": "this-is-not-valid"}`))

	handler := PostConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Configuration)
	s.NotNil(responseBody.Error)
}

func (s *PostConfigurationSuite) TestPostConfigurationBadName() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "a/b"})

	req.Body = io.NopCloser(strings.NewReader(`{}`))

	handler := PostConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostConfigurationSuite) TestPostConfigurationBadJSON() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	req.Body = io.NopCloser(strings.NewReader(`{what}`))

	handler := PostConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
