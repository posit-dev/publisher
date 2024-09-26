package api

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

type ApplySecretActionSuite struct {
	utiltest.Suite
}

func TestApplySecretActionSuite(t *testing.T) {
	suite.Run(t, new(ApplySecretActionSuite))
}

func (s *ApplySecretActionSuite) TestApplySecretActionAdd() {
	cfg := config.New()
	cfg.Secrets = []string{}
	err := applySecretAction(cfg, secretActionAdd, "secret1")
	s.NoError(err)
	s.Equal([]string{"secret1"}, cfg.Secrets)
}

func (s *ApplySecretActionSuite) TestApplySecretActionRemove() {
	cfg := config.New()
	cfg.Secrets = []string{"secret1", "secret2"}
	err := applySecretAction(cfg, secretActionRemove, "secret1")
	s.NoError(err)
	s.Equal([]string{"secret2"}, cfg.Secrets)
}

func (s *ApplySecretActionSuite) TestApplySecretActionUnknownAction() {
	cfg := config.New()
	err := applySecretAction(cfg, "invalidAction", "someSecret")
	s.Error(err)
	s.Equal("unknown action: invalidAction", err.Error())
}

type PostConfigSecretsSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	log logging.Logger
	h   http.HandlerFunc
}

func TestPostConfigSecretsSuite(t *testing.T) {
	suite.Run(t, new(PostConfigSecretsSuite))
}

func (s *PostConfigSecretsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostConfigSecretsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.h = PostConfigSecretsHandlerFunc(s.cwd, s.log)
}

func (s *PostConfigSecretsSuite) TestPostConfigSecretsAdd() {
	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	body := strings.NewReader(`{"action": "add", "secret": "test_secret"}`)
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/secrets", body)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	var res configDTO
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res)
	s.Equal([]string{"test_secret"}, res.Configuration.Secrets)
}

func (s *PostConfigSecretsSuite) TestPostConfigSecretsRemove() {
	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	cfg.Secrets = []string{"existing_secret", "test_secret"}
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	body := strings.NewReader(`{"action": "remove", "secret": "test_secret"}`)
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/secrets", body)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	var res configDTO
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res)
	s.Equal([]string{"existing_secret"}, res.Configuration.Secrets)
}

func (s *PostConfigSecretsSuite) TestPostConfigSecretsNotFound() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/secrets", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *PostConfigSecretsSuite) TestPostConfigSecretsInvalidAction() {
	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	body := strings.NewReader(`{"action": "invalid", "secret": "test_secret"}`)
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/configurations/myConfig/secrets", body)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	s.h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)

	bodyRes := rec.Body.String()
	s.Contains(bodyRes, "Bad Request: unknown action: invalid")
}
