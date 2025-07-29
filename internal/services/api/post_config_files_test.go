package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/server_type"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PostConfigFilesSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestPostConfigFilesSuite(t *testing.T) {
	suite.Run(t, new(PostConfigFilesSuite))
}

func (s *PostConfigFilesSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostConfigFilesSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostConfigFilesSuite) TestPostConfigFiles() {
	log := logging.New()

	configName := "myConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*"}
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/files", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	req.Body = io.NopCloser(strings.NewReader(`{
		"action": "exclude",
		"path": "app.py"
	}`))

	handler := PostConfigFilesHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// The new configuration should have been written.
	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal([]string{"*", "!app.py"}, updatedConfig.Files)

	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)
}

func (s *PostConfigFilesSuite) TestPostConfigFilesNotFound() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/files", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	handler := PostConfigFilesHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *PostConfigFilesSuite) TestPostConfigFilesBadJSON() {
	log := logging.New()

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/files", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	req.Body = io.NopCloser(strings.NewReader(`{what}`))

	handler := PostConfigFilesHandlerFunc(s.cwd, log)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostConfigFilesSuite) TestPostConfigFilesExcludeTwice() {
	log := logging.New()

	configName := "myConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*"}
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/files", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	handler := PostConfigFilesHandlerFunc(s.cwd, log)

	reqBody := `{
		"action": "exclude",
		"path": "app.py"
	}`

	req.Body = io.NopCloser(strings.NewReader(reqBody))
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// POST it again
	req.Body = io.NopCloser(strings.NewReader(reqBody))
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// The new configuration should have been written.
	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal([]string{"*", "!app.py"}, updatedConfig.Files)

	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)
}

func (s *PostConfigFilesSuite) TestPostConfigFilesIncludeTwice() {
	log := logging.New()

	configName := "myConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Files = []string{"*"}
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/files", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	handler := PostConfigFilesHandlerFunc(s.cwd, log)

	reqBody := `{
		"action": "include",
		"path": "app.py"
	}`

	req.Body = io.NopCloser(strings.NewReader(reqBody))
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// POST it again
	req.Body = io.NopCloser(strings.NewReader(reqBody))
	handler(rec, req)
	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// The new configuration should have been written.
	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Equal([]string{"*", "app.py"}, updatedConfig.Files)

	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)
}
