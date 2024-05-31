package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type DeleteDeploymentSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestDeleteDeploymentSuite(t *testing.T) {
	suite.Run(t, new(DeleteDeploymentSuite))
}

func (s *DeleteDeploymentSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *DeleteDeploymentSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func createSampleDeployment(root util.AbsolutePath, name string) (*deployment.Deployment, error) {
	path := deployment.GetDeploymentPath(root, name)
	d := deployment.New()
	d.ID = "12345678"
	d.ServerType = accounts.ServerTypeConnect
	d.ConfigName = "myConfig"
	cfg := config.New()
	cfg.Type = config.ContentTypePythonDash
	cfg.Entrypoint = "app.py"
	cfg.Python = &config.Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	d.Configuration = cfg
	return d, d.WriteFile(path)
}

func (s *DeleteDeploymentSuite) fileExists(path util.AbsolutePath) {
	exists, err := path.Exists()
	s.NoError(err)
	s.True(exists)
}

func (s *DeleteDeploymentSuite) fileDoesNotExist(path util.AbsolutePath) {
	exists, err := path.Exists()
	s.NoError(err)
	s.False(exists)
}

func (s *DeleteDeploymentSuite) TestDeleteDeployment() {
	targetToDelete := "myTarget"
	_, err := createSampleDeployment(s.cwd, targetToDelete)
	s.NoError(err)
	targetPath := deployment.GetDeploymentPath(s.cwd, targetToDelete)
	s.fileExists(targetPath)

	_, err = createSampleDeployment(s.cwd, "anotherTarget")
	s.NoError(err)
	otherPath := deployment.GetDeploymentPath(s.cwd, "anotherTarget")
	s.fileExists(otherPath)

	h := DeleteDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("DELETE", "/api/deployments/"+targetToDelete, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": targetToDelete})
	h(rec, req)

	s.Equal(http.StatusNoContent, rec.Result().StatusCode)
	s.fileDoesNotExist(targetPath)
	s.fileExists(otherPath)
}

func (s *DeleteDeploymentSuite) TestDeleteDeploymentNotFound() {
	h := DeleteDeploymentHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("DELETE", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
