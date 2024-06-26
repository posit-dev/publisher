package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PutConfigurationSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
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

	configName := "myConfig"
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/"+configName, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	req.Body = io.NopCloser(strings.NewReader(`{
		"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		"comments": [
			" This is a configuration file",
			" Use it to configure your project"
		],
		"type": "python-shiny",
		"entrypoint": "app.py",
		"python": {
			"version": "3.4.5",
			"packageManager": "pip"
		},
		"connect": {
			"kubernetes": {
				"defaultREnvironmentManagement": true
			}
		}
	}`))

	handler := PutConfigurationHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// Since the configuration was valid, it should have been written.
	configPath := config.GetConfigPath(s.cwd, configName)
	exists, err := configPath.Exists()
	s.NoError(err)
	s.True(exists)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Error)
	s.Equal(".", responseBody.ProjectDir)
	s.NotNil(responseBody.Configuration)
	s.Equal(config.ContentTypePythonShiny, responseBody.Configuration.Type)
	expected := true
	s.Equal(&expected, responseBody.Configuration.Connect.Kubernetes.DefaultREnvironmentManagement)
	s.Len(responseBody.Configuration.Comments, 2)
}

func (s *PutConfigurationSuite) TestPutConfigurationBadConfig() {
	log := logging.New()

	configName := "myConfig"
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/"+configName, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	req.Body = io.NopCloser(strings.NewReader(`{"type": "this-is-not-valid"}`))

	handler := PutConfigurationHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)

	// Since the configuration was invalid, it should not have been written.
	configPath := config.GetConfigPath(s.cwd, configName)
	exists, err := configPath.Exists()
	s.NoError(err)
	s.False(exists)
}

func (s *PutConfigurationSuite) TestPutConfigurationBadName() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "a/b"})

	req.Body = io.NopCloser(strings.NewReader(`{}`))

	handler := PutConfigurationHandlerFunc(s.cwd, log)
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

	handler := PutConfigurationHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PutConfigurationSuite) TestPutConfigurationSubdir() {
	log := logging.New()

	// Putting configuration to a subdirectory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	configName := "myConfig"
	dirParam := url.QueryEscape(relProjectDir.String())
	apiUrl := fmt.Sprintf("/api/configurations/%s?dir=%s", configName, dirParam)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("PUT", apiUrl, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{
		"name": configName,
	})

	req.Body = io.NopCloser(strings.NewReader(`{
		"$schema": "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
		"comments": [
			" This is a configuration file",
			" Use it to configure your project"
		],
		"type": "python-shiny",
		"entrypoint": "app.py",
		"python": {
			"version": "3.4.5",
			"packageManager": "pip"
		},
		"connect": {
			"kubernetes": {
				"defaultREnvironmentManagement": true
			}
		}
	}`))

	handler := PutConfigurationHandlerFunc(base, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// Since the configuration was valid, it should have been written.
	configPath := config.GetConfigPath(s.cwd, configName)
	exists, err := configPath.Exists()
	s.NoError(err)
	s.True(exists)

	var responseBody configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&responseBody)
	s.NoError(err)
	s.Nil(responseBody.Error)
	s.Equal(relProjectDir.String(), responseBody.ProjectDir)
	s.NotNil(responseBody.Configuration)
	s.Equal(config.ContentTypePythonShiny, responseBody.Configuration.Type)
	expected := true
	s.Equal(&expected, responseBody.Configuration.Connect.Kubernetes.DefaultREnvironmentManagement)
	s.Len(responseBody.Configuration.Comments, 2)
}
