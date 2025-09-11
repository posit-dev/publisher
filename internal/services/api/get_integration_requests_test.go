package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
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

type GetIntegrationRequestsTestSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetIntegrationRequestsTestSuite(t *testing.T) {
	suite.Run(t, new(GetIntegrationRequestsTestSuite))
}

func (s *GetIntegrationRequestsTestSuite) SetupTest() {
	s.log = logging.New()
	fs := afero.NewMemMapFs()
	dir, err := util.Getwd(fs)
	s.NoError(err)
	s.cwd = dir
	s.cwd.MkdirAll(0700)
}

func (s *GetIntegrationRequestsTestSuite) TestGetIntegrationRequestsSuccess() {
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.IntegrationRequests = []config.IntegrationRequest{
		{Name: "one", IntegrationType: "snowflake"},
		{Name: "two", IntegrationType: "database"},
	}
	name := "mycfg"
	path := config.GetConfigPath(s.cwd, name)
	s.NoError(cfg.WriteFile(path))

	req, err := http.NewRequest("GET", "/api/configurations/"+name+"/integration-requests", nil)
	s.NoError(err)
	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": name})

	h := GetIntegrationRequestsFuncHandler(s.cwd, s.log)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	var list []config.IntegrationRequest
	s.NoError(json.NewDecoder(rec.Body).Decode(&list))
	s.Len(list, 2)
	s.Equal("one", list[0].Name)
	s.Equal("two", list[1].Name)
}

func (s *GetIntegrationRequestsTestSuite) TestGetIntegrationRequestsNotFound() {
	name := "missing"
	req, err := http.NewRequest("GET", "/api/configurations/"+name+"/integration-requests", nil)
	s.NoError(err)
	rec := httptest.NewRecorder()
	req = mux.SetURLVars(req, map[string]string{"name": name})

	h := GetIntegrationRequestsFuncHandler(s.cwd, s.log)
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
