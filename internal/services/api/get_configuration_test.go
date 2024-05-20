package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetConfigurationuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetConfigurationuite(t *testing.T) {
	suite.Run(t, new(GetConfigurationuite))
}

func (s *GetConfigurationuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConfigurationuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetConfigurationuite) makeConfiguration(name string) *config.Config {
	path := config.GetConfigPath(s.cwd, name)
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	err := cfg.WriteFile(path)
	s.NoError(err)
	return cfg
}

func (s *GetConfigurationuite) TestGetConfiguration() {
	cfg := s.makeConfiguration("myConfig")

	h := GetConfigurationHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	relPath := filepath.Join(".posit", "publish", "myConfig.toml")
	s.Equal(s.cwd.Join(relPath).String(), res.Path)
	s.Equal(relPath, res.RelPath)

	s.Equal("myConfig", res.Name)
	s.Nil(res.Error)
	s.Equal(cfg, res.Configuration)
}

func (s *GetConfigurationuite) TestGetConfigurationError() {
	path2 := config.GetConfigPath(s.cwd, "myConfig")
	err := path2.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetConfigurationHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	var nilConfiguration *config.Config
	relPath := filepath.Join(".posit", "publish", "myConfig.toml")
	s.Equal(s.cwd.Join(relPath).String(), res.Path)
	s.Equal(relPath, res.RelPath)

	s.Equal("myConfig", res.Name)
	s.NotNil(res.Error)
	s.Equal(nilConfiguration, res.Configuration)
}

func (s *GetConfigurationuite) TestGetConfigurationNotFound() {
	h := GetConfigurationHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
