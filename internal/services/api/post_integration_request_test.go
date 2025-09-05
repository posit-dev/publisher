// Copyright (C) 2025 by Posit Software, PBC.

package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostIntegrationRequestTestSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestPostIntegrationRequestTestSuite(t *testing.T) {
	suite.Run(t, new(PostIntegrationRequestTestSuite))
}

func (s *PostIntegrationRequestTestSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostIntegrationRequestTestSuite) SetupTest() {
	// in-memory file system that only exists for the duration of the test
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostIntegrationRequestTestSuite) TestPostIntegrationRequest() {
	log := logging.New()
	configName := "testConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	body := PostIntegrationRequestRequest{
		Name: "test-ir",
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})
	h := PostIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusCreated, rec.Result().StatusCode)

	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)

	// Verify the integration request was added to the config
	s.Len(updatedConfig.IntegrationRequests, 1, "Should have one integration request")
	s.Equal("test-ir", updatedConfig.IntegrationRequests[0].Name)
}

func (s *PostIntegrationRequestTestSuite) TestPostIntegrationRequestAlreadyExists() {
	log := logging.New()
	configName := "testConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.IntegrationRequests = []config.IntegrationRequest{
		{
			Name:   "existing-integration",
			Config: map[string]any{"auth_mode": "Confidential"},
		},
	}
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	body := PostIntegrationRequestRequest{
		Name:   "existing-integration",
		Config: map[string]any{"auth_mode": "Confidential"},
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})
	h := PostIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusCreated, rec.Result().StatusCode)

	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)

	// Verify the integration request was not added to the config
	s.Len(updatedConfig.IntegrationRequests, 1, "Should still have one integration request")
	s.Equal("existing-integration", updatedConfig.IntegrationRequests[0].Name)
}

func (s *PostIntegrationRequestTestSuite) TestPostIntegrationRequestConfigNotFound() {
	log := logging.New()
	configName := "missingConfig" // no file created

	body := PostIntegrationRequestRequest{
		Name: "new-ir",
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)
	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	h := PostIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *PostIntegrationRequestTestSuite) TestPostIntegrationRequestUnknownField() {
	log := logging.New()
	configName := "testConfigUF"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	// include unknown field "unexpected"
	payload := []byte(`{"name":"ir-uf","unexpected":"value"}`)
	req, err := http.NewRequest("POST", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(payload))
	s.NoError(err)
	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})

	h := PostIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}
