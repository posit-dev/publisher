package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
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

	h := NewGetConfigRequirementsHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := requirementsDTO{}
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

	h := NewGetConfigRequirementsHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsNoRequirementsFile() {
	cfg := config.New()
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

	h := NewGetConfigRequirementsHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetConfigRequirementsSuite) TestGetConfigRequirementsNoPythonInConfig() {
	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err := cfg.WriteFile(config.GetConfigPath(s.cwd, "myConfig"))
	s.NoError(err)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/configurations/myConfig/requirements", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myConfig"})

	h := NewGetConfigRequirementsHandler(s.cwd, s.log)
	h.ServeHTTP(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}
