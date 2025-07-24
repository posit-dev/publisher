package api

import (
	"encoding/json"
	"errors"
	"github.com/posit-dev/publisher/internal/server_type"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2024 by Posit Software, PBC.

type GetDeploymentEnvSuite struct {
	utiltest.Suite
	log logging.Logger
	cwd util.AbsolutePath
}

func TestGetDeploymentEnvSuite(t *testing.T) {
	suite.Run(t, new(GetDeploymentEnvSuite))
}

func (s *GetDeploymentEnvSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetDeploymentEnvSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)

	connectClientFactory = connect.NewConnectClient
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnv() {
	path := deployment.GetDeploymentPath(s.cwd, "dep")
	d := deployment.New()
	d.ID = "123"
	d.ServerURL = "https://connect.example.com"
	d.WriteFile(path, "", s.log)

	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: server_type.ServerTypeConnect,
	}
	lister.On("GetAccountByServerURL", "https://connect.example.com").Return(acct, nil)

	client := connect.NewMockClient()
	var env types.Environment = []string{"foo", "bar"}
	client.On("GetEnvVars", types.ContentID("123"), s.log).Return(&env, nil)
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}

	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, lister)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/dep/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "dep"})
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	res := types.Environment{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(&res))
	s.Equal(env, res)
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnvDeploymentNotFound() {
	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, &accounts.MockAccountList{})

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/nonexistant/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"id": "nonexistant"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnvFileError() {
	path := deployment.GetDeploymentPath(s.cwd, "dep")
	err := path.WriteFile([]byte(`foo = 1`), 0666)
	s.NoError(err)

	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, &accounts.MockAccountList{})

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/dep/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "dep"})
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "deployment dep is invalid")
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnvDeploymentNotDeployed() {
	path := deployment.GetDeploymentPath(s.cwd, "dep")
	d := deployment.New()
	d.WriteFile(path, "", s.log)

	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, &accounts.MockAccountList{})

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/dep/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "dep"})
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "deployment dep is not deployed")
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnvNoCredential() {
	path := deployment.GetDeploymentPath(s.cwd, "dep")
	d := deployment.New()
	d.ID = "123"
	d.ServerURL = "https://connect.example.com"
	d.WriteFile(path, "", s.log)

	lister := &accounts.MockAccountList{}
	lister.On("GetAccountByServerURL", "https://connect.example.com").Return(nil, errors.New("no such account"))

	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, lister)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/dep/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "dep"})
	h(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "no credential found to use with deployment dep")
}

func (s *GetDeploymentEnvSuite) TestGetDeploymentEnvPassesStatusFromServer() {
	path := deployment.GetDeploymentPath(s.cwd, "dep")
	d := deployment.New()
	d.ID = "123"
	d.ServerURL = "https://connect.example.com"
	d.WriteFile(path, "", s.log)

	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: server_type.ServerTypeConnect,
	}
	lister.On("GetAccountByServerURL", "https://connect.example.com").Return(acct, nil)

	client := connect.NewMockClient()
	httpErr := http_client.NewHTTPError("https://connect.example.com", "GET", http.StatusNotFound, "uh oh")
	client.On("GetEnvVars", types.ContentID("123"), s.log).Return(nil, httpErr)
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}

	h := GetDeploymentEnvironmentHandlerFunc(s.cwd, s.log, lister)

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/api/deployments/dep/environment", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "dep"})
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}
