package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetConfigurationsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
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

func (s *GetConfigurationsSuite) makeConfiguration(name string) *config.Config {
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

func (s *GetConfigurationsSuite) TestGetConfigurations() {
	cfg := s.makeConfiguration("default")

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

	relPath := filepath.Join(".posit", "publish", "default.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)

	s.Equal("default", res[0].Name)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsError() {
	cfg := s.makeConfiguration("default")

	path2 := config.GetConfigPath(s.cwd, "other")
	err := path2.WriteFile([]byte(`foo = 1`), 0666)
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

	relPath := filepath.Join(".posit", "publish", "default.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)

	s.Equal("default", res[0].Name)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)

	var nilConfiguration *config.Config
	relPath = filepath.Join(".posit", "publish", "other.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[1].Path)
	s.Equal(relPath, res[1].RelPath)

	s.Equal("other", res[1].Name)
	s.NotNil(res[1].Error)
	s.Equal(nilConfiguration, res[1].Configuration)
}
