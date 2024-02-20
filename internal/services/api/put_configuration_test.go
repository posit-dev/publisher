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

type PutConfigurationSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestPutConfigurationSuite(t *testing.T) {
	suite.Run(t, new(PutConfigurationSuite))
}

func (s *PutConfigurationSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PutConfigurationSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PutConfigurationSuite) TestPutConfiguration() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/myConfig", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{
		"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		"type": "python-shiny",
		"entrypoint": "app.py"
	}`))

	handler := PutConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Error)
	s.NotNil(responseBody.Configuration)
	s.Equal(config.ContentTypePythonShiny, responseBody.Configuration.Type)
}

func (s *PutConfigurationSuite) TestPutConfigurationBadConfig() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	req.Body = io.NopCloser(strings.NewReader(`{"type": "this-is-not-valid"}`))

	handler := PutConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Configuration)
	s.NotNil(responseBody.Error)
}

func (s *PutConfigurationSuite) TestPutConfigurationBadName() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "a/b"})

	req.Body = io.NopCloser(strings.NewReader(`{}`))

	handler := PutConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PutConfigurationSuite) TestPutConfigurationBadJSON() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	req.Body = io.NopCloser(strings.NewReader(`{what}`))

	handler := PutConfigurationHandlerFunc(util.Path{}, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
