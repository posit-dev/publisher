package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type GetDeploymentsSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.Path
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
	path := deployment.GetDeploymentPath(s.cwd, "myTargetName")
	d := deployment.New()
	d.Id = "myTargetName"
	d.ServerType = accounts.ServerTypeConnect
	d.ConfigName = "myConfig"
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	d.Configuration = *cfg
	err := d.WriteFile(path)
	s.NoError(err)

	h := GetDeploymentsHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments", nil)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := []deploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 1)
	s.Nil(res[0].Error)
	s.NotNil(res[0].Deployment)
	s.Equal(d, res[0].Deployment)
	s.Equal(filepath.Join(".posit", "publish", "myConfig.toml"), res[0].ConfigPath)
	s.Equal(types.ContentID("myTargetName"), res[0].Deployment.Id)
}

func (s *GetDeploymentsSuite) TestGetDeploymentsError() {
	path := deployment.GetDeploymentPath(s.cwd, "target1")
	d := deployment.New()
	d.Id = "target1"
	d.ServerType = accounts.ServerTypeConnect
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	d.Configuration = *cfg
	err := d.WriteFile(path)
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

	res := []deploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Len(res, 2)
	s.Nil(res[0].Error)
	s.NotNil(res[0].Deployment)
	s.Equal(d, res[0].Deployment)
	s.Equal(types.ContentID("target1"), res[0].Deployment.Id)

	var nilDeployment *deployment.Deployment
	s.Equal(nilDeployment, res[1].Deployment)
	s.NotNil(res[1].Error)
}
