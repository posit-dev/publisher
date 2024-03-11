package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PostDeploymentsSuite struct {
	utiltest.Suite
	cwd util.Path
}

func TestPostDeploymentsSuite(t *testing.T) {
	suite.Run(t, new(PostDeploymentsSuite))
}

func (s *PostDeploymentsSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *PostDeploymentsSuite) TestPostDeployments() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: accounts.ServerTypeConnect,
	}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	h := PostDeploymentsHandlerFunc(s.cwd, logging.New(), lister)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"account": "myAccount",
		"saveName": "newDeployment"
	}`)
	req, err := http.NewRequest("POST", "/api/deployments", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := preDeploymentDTO{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))

	actualPath, err := util.NewPath(res.Path, s.cwd.Fs()).Rel(s.cwd)
	s.NoError(err)
	s.Equal(filepath.Join(".posit", "publish", "deployments", "newDeployment.toml"), actualPath.String())

	s.Equal("newDeployment", res.Name)
	s.Equal("newDeployment", res.SaveName)
	s.Equal(accounts.ServerTypeConnect, res.ServerType)
	s.Equal(acct.URL, res.ServerURL)
	s.Equal(deploymentStateNew, res.State)
}

func (s *PostDeploymentsSuite) TestPostDeploymentsBadRequest() {
	h := PostDeploymentsHandlerFunc(s.cwd, logging.New(), nil)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"what": "huh?",
	}`)
	req, err := http.NewRequest("POST", "/api/deployments", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentsSuite) TestPostDeploymentsEmptySaveName() {
	h := PostDeploymentsHandlerFunc(s.cwd, logging.New(), nil)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"saveName": "",
	}`)
	req, err := http.NewRequest("POST", "/api/deployments", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentsSuite) TestPostDeploymentsAccountNotFound() {
	lister := &accounts.MockAccountList{}
	acctErr := fmt.Errorf("cannot get account named 'myAccount': %w", accounts.ErrAccountNotFound)
	lister.On("GetAccountByName", "myAccount").Return(nil, acctErr)

	h := PostDeploymentsHandlerFunc(s.cwd, logging.New(), lister)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"account": "myAccount",
		"saveName": "newDeployment"
	}`)
	req, err := http.NewRequest("POST", "/api/deployments", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
	resp, err := io.ReadAll(rec.Result().Body)
	s.NoError(err)
	s.Contains(string(resp), "no such account")
	s.Contains(string(resp), "myAccount")
}

func (s *PostDeploymentsSuite) TestPostDeploymentsConflict() {
	s.TestPostDeployments()
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	h := PostDeploymentsHandlerFunc(s.cwd, logging.New(), lister)

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{
		"account": "myAccount",
		"saveName": "newDeployment"
	}`)
	req, err := http.NewRequest("POST", "/api/deployments", body)
	s.NoError(err)
	h(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}
