package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetDeploymentSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
}

func TestGetDeploymentSuite(t *testing.T) {
	suite.Run(t, new(GetDeploymentSuite))
}

func (s *GetDeploymentSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetDeploymentSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetDeploymentSuite) TestGetDeployment() {
	d, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	h := GetDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := fullDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Deployment)
	s.Nil(res.Error)
	s.Equal(deploymentStateDeployed, res.State)
	s.Equal(*d, res.Deployment)
	s.Equal("myTargetName", res.Name)
	s.Equal(filepath.Join(".posit", "publish", "myConfig.toml"), res.ConfigPath)
	s.Equal(types.ContentID("12345678"), res.Deployment.ID)
}

func (s *GetDeploymentSuite) TestGetDeploymentError() {
	path2 := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	err := path2.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := deploymentErrorDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Error)
}

func (s *GetDeploymentSuite) TestGetDeploymentNotFound() {
	path2 := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	err := path2.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/nonexistent", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"id": "nonexistent"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
