package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetDeploymentsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetDeploymentsSuite(t *testing.T) {
	suite.Run(t, new(GetDeploymentsSuite))
}

func (s *GetDeploymentsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetDeploymentsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *GetDeploymentsSuite) TestGetDeployments() {
	d, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	h := GetDeploymentsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []fullDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 1)

	s.Nil(res[0].Error)
	s.Equal("myTargetName", res[0].Name)
	s.Equal(".", res[0].ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "deployments", "myTargetName.toml").String(), res[0].Path)
	s.NotNil(res[0].Deployment)
	s.Equal(*d, res[0].Deployment)
	s.Equal(s.cwd.Join(".posit", "publish", "myConfig.toml").String(), res[0].ConfigPath)
	s.Equal(types.ContentID("12345678"), res[0].Deployment.ID)
}

func (s *GetDeploymentsSuite) TestGetDeploymentsError() {
	d, err := createSampleDeployment(s.cwd, "target1")
	s.NoError(err)

	path2 := deployment.GetDeploymentPath(s.cwd, "target2")
	err = path2.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetDeploymentsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []struct {
		fullDeploymentDTO
		Error *types.AgentError `json:"error,omitempty"`
	}{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)

	s.Nil(res[0].Error)
	s.Equal(deploymentStateDeployed, res[0].State)
	s.NotNil(res[0].Deployment)
	s.Equal("target1", res[0].Name)
	s.Equal(".", res[0].ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "deployments", "target1.toml").String(), res[0].Path)
	s.Equal(*d, res[0].Deployment)
	s.Equal(types.ContentID("12345678"), res[0].Deployment.ID)

	s.NotNil(res[1].Error)
	s.Equal("target2", res[1].Name)
	s.Equal(".", res[1].ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "deployments", "target2.toml").String(), res[1].Path)
	s.Equal(deploymentStateError, res[1].State)
}

func (s *GetDeploymentsSuite) TestGetDeploymentsFromSubdir() {
	d, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	// Getting deployments from a subdirectory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	h := GetDeploymentsHandlerFunc(base, s.log)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments?dir="+dirParam, nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []fullDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 1)

	s.Nil(res[0].Error)
	s.Equal("myTargetName", res[0].Name)
	s.Equal(relProjectDir.String(), res[0].ProjectDir)
	s.Equal(s.cwd.Join(".posit", "publish", "deployments", "myTargetName.toml").String(), res[0].Path)

	s.NotNil(res[0].Deployment)
	s.Equal(*d, res[0].Deployment)
	s.Equal(s.cwd.Join(".posit", "publish", "myConfig.toml").String(), res[0].ConfigPath)
	s.Equal(types.ContentID("12345678"), res[0].Deployment.ID)
}

func (s *GetDeploymentsSuite) TestGetDeploymentsBadDir() {
	// It's a Bad Request to try to list deployments from a directory outside the project
	_, err := createSampleDeployment(s.cwd, "myTargetName")
	s.NoError(err)

	h := GetDeploymentsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/?dir=../middleware", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}
