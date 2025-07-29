package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type GetConfigRequirementsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetConfigRequirementsSuite(t *testing.T) {
	suite.Run(t, new(GetConfigRequirementsSuite))
}

func (s *GetConfigRequirementsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConfigRequirementsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirements() {
	reqs := []byte("numpy\npandas\n")
	s.cwd.Join("requirements-dev.txt").WriteFile(reqs, 0666)

	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Python = &config.Python{
		Version:        "3.11.3",
		PackageManager: "pip",
		PackageFile:    "requirements-dev.txt",
	}
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigPythonPackagesHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := pythonPackagesDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Requirements)
	s.Equal([]string{
		"numpy",
		"pandas",
	}, res.Requirements)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsNotFound() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigPythonPackagesHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsNoRequirementsFile() {
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Python = &config.Python{
		Version:        "3.11.3",
		PackageManager: "pip",
		PackageFile:    "requirements-dev.txt",
	}
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigPythonPackagesHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsNoPythonInConfig() {
	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigPythonPackagesHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsSubdir() {
	reqs := []byte("numpy\npandas\n")
	s.cwd.Join("requirements-dev.txt").WriteFile(reqs, 0666)

	// We are getting requirements from a project directory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	cfg := config.New()
	cfg.ProductType = config.ProductTypeConnect
	cfg.Type = config.ContentTypeHTML
	cfg.Python = &config.Python{
		Version:        "3.11.3",
		PackageManager: "pip",
		PackageFile:    "requirements-dev.txt",
	}
	err = cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements?dir="+dirParam, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigPythonPackagesHandler(base, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := pythonPackagesDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Requirements)
	s.Equal([]string{
		"numpy",
		"pandas",
	}, res.Requirements)
}
