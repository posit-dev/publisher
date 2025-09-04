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

type DeleteIntegrationRequestTestSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestDeleteIntegrationRequestTestSuite(t *testing.T) {
	suite.Run(t, new(DeleteIntegrationRequestTestSuite))
}

func (s *DeleteIntegrationRequestTestSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *DeleteIntegrationRequestTestSuite) SetupTest() {
	// in-memory file system that only exists for the duration of the test
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *DeleteIntegrationRequestTestSuite) TestDeleteIntegrationRequest() {
	log := logging.New()
	configName := "testConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect

	cfg.IntegrationRequests = []config.IntegrationRequest{
		{
			Name:            "test-ir",
			Description:     "Test description",
			AuthType:        "oauth2",
			IntegrationType: "snowflake",
			Config: map[string]any{
				"auth_mode": "Confidential",
				"host":      "test.snowflakecomputing.com",
			},
		},
	}

	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	body := DeleteIntegrationRequestRequest{
		Name:            "test-ir",
		Description:     "Test description",
		AuthType:        "oauth2",
		IntegrationType: "snowflake",
		Config: map[string]any{
			"auth_mode": "Confidential",
			"host":      "test.snowflakecomputing.com",
		},
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("DELETE", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})
	h := DeleteIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	var res configDTO
	err = json.NewDecoder(rec.Result().Body).Decode(&res)
	s.NoError(err)
	s.Nil(res.Error)
	s.NotNil(res.Configuration)
	s.Equal(res.Configuration, updatedConfig)

	// verify that the integration request was deleted from config
	s.Len(updatedConfig.IntegrationRequests, 0, "Should have no integration requests left")
}

func (s *DeleteIntegrationRequestTestSuite) TestDeleteIntegrationRequestNotFound() {
	log := logging.New()
	configName := "testConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect

	cfg.IntegrationRequests = []config.IntegrationRequest{
		{
			Name:            "test-ir",
			Description:     "Test description",
			AuthType:        "oauth2",
			IntegrationType: "snowflake",
			Config: map[string]any{
				"auth_mode": "Confidential",
				"host":      "test.snowflakecomputing.com",
			},
		},
	}

	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	body := DeleteIntegrationRequestRequest{
		Name:            "different-ir",
		Description:     "Different description",
		AuthType:        "basic",
		IntegrationType: "database",
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("DELETE", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})
	h := DeleteIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// verify that the original integration request is still in the config
	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Len(updatedConfig.IntegrationRequests, 1, "Should still have one integration request")
	s.Equal("test-ir", updatedConfig.IntegrationRequests[0].Name)
}

func (s *DeleteIntegrationRequestTestSuite) TestDeleteIntegrationRequestMultiple() {
	log := logging.New()
	configName := "testConfig"
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect

	cfg.IntegrationRequests = []config.IntegrationRequest{
		{
			Name:            "first-ir",
			IntegrationType: "snowflake",
		},
		{
			Name:            "second-ir",
			IntegrationType: "database",
		},
		{
			Name:            "third-ir",
			IntegrationType: "aws",
		},
	}

	configPath := config.GetConfigPath(s.cwd, configName)
	err := cfg.WriteFile(configPath)
	s.NoError(err)

	body := DeleteIntegrationRequestRequest{
		Name:            "second-ir",
		IntegrationType: "database",
	}
	data, err := json.Marshal(body)
	s.NoError(err)

	req, err := http.NewRequest("DELETE", "/api/configurations/"+configName+"/integration-requests", bytes.NewBuffer(data))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": configName})
	h := DeleteIntegrationRequestFuncHandler(s.cwd, log)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// verify that only the targeted integration request was deleted
	updatedConfig, err := config.FromFile(configPath)
	s.NoError(err)
	s.Len(updatedConfig.IntegrationRequests, 2, "Should have two integration requests left")
	s.Equal("first-ir", updatedConfig.IntegrationRequests[0].Name)
	s.Equal("third-ir", updatedConfig.IntegrationRequests[1].Name)
}
