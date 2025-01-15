// Copyright (C) 2024 by Posit Software, PBC.

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostDeploymentCancelTestSuite struct {
	utiltest.Suite
	log logging.Logger
	fs  afero.Fs
	cwd util.AbsolutePath
}

func TestPostDeploymentCancelTestSuite(t *testing.T) {
	suite.Run(t, new(PostDeploymentCancelTestSuite))
}

func (s *PostDeploymentCancelTestSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *PostDeploymentCancelTestSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	cwd, err := util.Getwd(s.fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostDeploymentCancelTestSuite) Test200WithLocalIDMatch() {
	deploymentName := "newDeployment"
	localId := "abc"

	d := deployment.New()

	_, err := d.WriteFile(deployment.GetDeploymentPath(s.cwd, deploymentName), "abc", true, s.log)
	s.NoError(err)

	h := PostDeploymentCancelHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/"+deploymentName+"/cancel/"+localId, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{
		"name":    deploymentName,
		"localid": localId,
	})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := preDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	s.NotEmpty(res.DismissedAt)
}

func (s *PostDeploymentCancelTestSuite) Test200WithoutLocalIDMatch() {
	deploymentName := "newDeployment"

	d := deployment.New()

	_, err := d.WriteFile(deployment.GetDeploymentPath(s.cwd, deploymentName), "abc", true, s.log)
	s.NoError(err)

	h := PostDeploymentCancelHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/"+deploymentName+"/cancel/xyz", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{
		"name":    deploymentName,
		"localid": "xyz", // not current localID in file
	})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := preDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	// request was successful but not applied
	s.Empty(res.DismissedAt)
}

func (s *PostDeploymentCancelTestSuite) Test404() {
	deploymentName := "newDeployment"
	localId := "abc"

	h := PostDeploymentCancelHandlerFunc(s.cwd, s.log)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/"+deploymentName+"/cancel/"+localId, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{
		"name":    deploymentName,
		"localid": localId,
	})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
	s.Equal("text/plain; charset=utf-8", rec.Header().Get("content-type"))
}
