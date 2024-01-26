package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetConfigurationsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestGetConfigurationsSuite(t *testing.T) {
	suite.Run(t, new(GetConfigurationsSuite))
}

func (s *GetConfigurationsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConfigurationsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetConfigurationsSuite) TestGetConfigurations() {
	path := config.GetConfigPath(s.cwd, "myConfig")
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(path)
	s.NoError(err)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 1)

	s.Equal(filepath.Join(".posit", "publish", "myConfig.toml"), res[0].Path)
	s.Equal("myConfig", res[0].Name)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsError() {
	path := config.GetConfigPath(s.cwd, "config1")
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	err := cfg.WriteFile(path)
	s.NoError(err)

	path2 := config.GetConfigPath(s.cwd, "config2")
	err = path2.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)

	s.Equal(filepath.Join(".posit", "publish", "config1.toml"), res[0].Path)
	s.Equal("config1", res[0].Name)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)

	var nilConfiguration *config.Config
	s.Equal(filepath.Join(".posit", "publish", "config2.toml"), res[1].Path)
	s.Equal("config2", res[1].Name)
	s.NotNil(res[1].Error)
	s.Equal(nilConfiguration, res[1].Configuration)
}
