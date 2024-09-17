package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetDeploymentSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
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
	s.Equal(".", res.ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "myConfig.toml").String(), res.ConfigPath)
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
	s.Equal("myTargetName", res.Name)
	s.Equal(".", res.ProjectDir)
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

func (s *GetDeploymentSuite) TestGetPreDeployment() {
	path := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.ServerType = accounts.ServerTypeConnect
	testError := errors.New("test error")
	d.Error = types.AsAgentError(testError)
	err := d.WriteFile(path)
	s.NoError(err)

	h := GetDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := preDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.NotNil(res.Error)
	s.Equal("test error", res.Error.Message)
	s.Equal(deploymentStateNew, res.State)
	s.Equal("myTargetName", res.Name)
	s.Equal(".", res.ProjectDir)
}

func (s *GetDeploymentSuite) TestGetDeploymentFromSubdir() {
	d, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	// Getting deployment from a subdirectory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	h := GetDeploymentHandlerFunc(base, s.log)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/myTargetName?dir="+dirParam, nil)
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
	s.Equal(relProjectDir.String(), res.ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "myConfig.toml").String(), res.ConfigPath)
	s.Equal(relProjectDir.String(), res.ProjectDir)
	s.Equal(types.ContentID("12345678"), res.Deployment.ID)
}

func (s *GetDeploymentSuite) TestGetDeploymentBadDir() {
	// It's a Bad Request to try to get a deployment from a directory outside the project
	_, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	h := GetDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/myTargetName?dir=../middleware", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"id": "myTargetName"})
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
