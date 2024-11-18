package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	r, err := config.FromFile(path)
	s.NoError(err)
	return r
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
	s.Equal(".", res[0].ProjectDir)
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
	s.Equal(".", res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)

	var nilConfiguration *config.Config
	relPath = filepath.Join(".posit", "publish", "other.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[1].Path)
	s.Equal(relPath, res[1].RelPath)

	s.Equal("other", res[1].Name)
	s.Equal(".", res[1].ProjectDir)
	s.NotNil(res[1].Error)
	s.Equal(nilConfiguration, res[1].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsFromSubdir() {
	cfg := s.makeConfiguration("default")

	// Getting configurations from a subdirectory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)
	h := GetConfigurationsHandlerFunc(base, s.log)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations?dir="+dirParam, nil)
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
	s.Equal(relProjectDir.String(), res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(cfg, res[0].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsByEntrypoint() {
	matchingConfig := s.makeConfiguration("matching")
	path := config.GetConfigPath(s.cwd, "nonmatching")
	nonMatchingConfig := config.New()
	nonMatchingConfig.Type = config.ContentTypeHTML
	nonMatchingConfig.Entrypoint = "index.html"
	err := nonMatchingConfig.WriteFile(path)
	s.NoError(err)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations?entrypoint=app.py", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 1)

	relPath := filepath.Join(".posit", "publish", "matching.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)

	s.Equal("matching", res[0].Name)
	s.Equal(".", res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(matchingConfig, res[0].Configuration)
}

func (s *GetConfigurationsSuite) makeSubdirConfiguration(name string, subdir string) *config.Config {
	subdirPath := s.cwd.Join(subdir)
	err := subdirPath.MkdirAll(0777)
	s.NoError(err)

	path := config.GetConfigPath(subdirPath, name)
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash

	// make entrypoints unique by subdirectory for filtering
	cfg.Entrypoint = subdir + ".py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	err = cfg.WriteFile(path)
	s.NoError(err)
	r, err := config.FromFile(path)
	s.NoError(err)
	return r
}

func (s *GetConfigurationsSuite) TestGetConfigurationsRecursive() {
	cfg0 := s.makeSubdirConfiguration("config0", ".")
	cfg1 := s.makeSubdirConfiguration("config1", "subdir")
	cfg2 := s.makeSubdirConfiguration("config2", "subdir")
	subsubdir := filepath.Join("theAlphabeticvallyLastSubdir", "nested")
	cfg3 := s.makeSubdirConfiguration("config3", subsubdir)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations?recursive=true", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 4)

	relPath := filepath.Join(".posit", "publish", "config0.toml")
	s.Equal(s.cwd.Join(relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)
	s.Equal("config0", res[0].Name)
	s.Equal(".", res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(cfg0, res[0].Configuration)

	relPath = filepath.Join(".posit", "publish", "config1.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[1].Path)
	s.Equal(relPath, res[1].RelPath)
	s.Equal("config1", res[1].Name)
	s.Equal("subdir", res[1].ProjectDir)
	s.Nil(res[1].Error)
	s.Equal(cfg1, res[1].Configuration)

	relPath = filepath.Join(".posit", "publish", "config2.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[2].Path)
	s.Equal(relPath, res[2].RelPath)
	s.Equal("config2", res[2].Name)
	s.Equal("subdir", res[2].ProjectDir)
	s.Nil(res[2].Error)
	s.Equal(cfg2, res[2].Configuration)

	relPath = filepath.Join(".posit", "publish", "config3.toml")
	s.Equal(s.cwd.Join(subsubdir, relPath).String(), res[3].Path)
	s.Equal(relPath, res[3].RelPath)
	s.Equal("config3", res[3].Name)
	s.Equal(subsubdir, res[3].ProjectDir)
	s.Nil(res[3].Error)
	s.Equal(cfg3, res[3].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsRecursiveWithEntrypoint() {
	_ = s.makeSubdirConfiguration("config0", ".")
	cfg1 := s.makeSubdirConfiguration("config1", "subdir")
	cfg2 := s.makeSubdirConfiguration("config2", "subdir")
	subsubdir := filepath.Join("theAlphabeticvallyLastSubdir", "nested")
	_ = s.makeSubdirConfiguration("config3", subsubdir)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations?recursive=true&entrypoint=subdir.py", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)

	relPath := filepath.Join(".posit", "publish", "config1.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)
	s.Equal("config1", res[0].Name)
	s.Equal("subdir", res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(cfg1, res[0].Configuration)

	relPath = filepath.Join(".posit", "publish", "config2.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[1].Path)
	s.Equal(relPath, res[1].RelPath)
	s.Equal("config2", res[1].Name)
	s.Equal("subdir", res[1].ProjectDir)
	s.Nil(res[1].Error)
	s.Equal(cfg2, res[1].Configuration)
}

func (s *GetConfigurationsSuite) TestGetConfigurationsRecursiveWithSubdir() {
	_ = s.makeSubdirConfiguration("config0", ".")
	cfg1 := s.makeSubdirConfiguration("config1", "subdir")
	cfg2 := s.makeSubdirConfiguration("config2", "subdir")
	subsubdir := filepath.Join("theAlphabeticvallyLastSubdir", "nested")
	_ = s.makeSubdirConfiguration("config3", subsubdir)

	h := GetConfigurationsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations?recursive=true&dir=subdir", nil)
	s.NoError(err)

	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []configDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)

	relPath := filepath.Join(".posit", "publish", "config1.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[0].Path)
	s.Equal(relPath, res[0].RelPath)
	s.Equal("config1", res[0].Name)
	s.Equal("subdir", res[0].ProjectDir)
	s.Nil(res[0].Error)
	s.Equal(cfg1, res[0].Configuration)

	relPath = filepath.Join(".posit", "publish", "config2.toml")
	s.Equal(s.cwd.Join("subdir", relPath).String(), res[1].Path)
	s.Equal(relPath, res[1].RelPath)
	s.Equal("config2", res[1].Name)
	s.Equal("subdir", res[1].ProjectDir)
	s.Nil(res[1].Error)
	s.Equal(cfg2, res[1].Configuration)
}
