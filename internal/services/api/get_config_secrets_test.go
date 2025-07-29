package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type GetConfigSecretsSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	log logging.Logger
	h   http.HandlerFunc
}

func TestGetConfigSecretsSuite(t *testing.T) {
	suite.Run(t, new(GetConfigSecretsSuite))
}

func (s *GetConfigSecretsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConfigSecretsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.h = GetConfigSecretsHandlerFunc(s.cwd, s.log)
}

func (s *GetConfigSecretsSuite) TestGetConfigSecrets() {
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Secrets = []string{
		"secret1",
		"secret2",
	}
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/secrets", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []string{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res)
	s.Equal(cfg.Secrets, res)
}

func (s *GetConfigSecretsSuite) TestGetConfigSecretsEmptySecrets() {
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/secrets", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []string{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res)
	s.Equal([]string{}, res)
}

func (s *GetConfigSecretsSuite) TestGetConfigSecretsNotFound() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/secrets", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
