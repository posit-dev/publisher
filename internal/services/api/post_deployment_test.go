package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostDeploymentHandlerFuncSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
	log logging.Logger
}

func TestPostDeploymentHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PostDeploymentHandlerFuncSuite))
}

func (s *PostDeploymentHandlerFuncSuite) SetupTest() {
	stateFactory = state.New
	publisherFactory = publish.NewFromState

	afs := afero.NewMemMapFs()
	cwd, err := util.Getwd(afs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
	s.log = logging.New()
}

type mockPublisher struct {
	mock.Mock
}

func (m *mockPublisher) PublishDirectory() error {
	args := m.Called()
	return args.Error(0)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFunc() {
	log := logging.New()

	rec := httptest.NewRecorder()

	// Base URL
	baseURL := "/api/deployments/myTargetName"

	// Create a url.URL struct
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		panic(err)
	}

	// Create a url.Values to hold query parameters
	queryParams := url.Values{}
	queryParams.Add("dir", ".")
	queryParams.Add("r", "/bin/my_r")
	queryParams.Add("python", "/bin/my_python")

	// Encode query parameters and set them to the URL
	parsedURL.RawQuery = queryParams.Encode()

	req, err := http.NewRequest("POST", parsedURL.String(), nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "local",
			"config": "default",
			"insecure": false
		}`))

	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(nil)
	publisherFactory = func(
		state *state.State,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		emitter events.Emitter,
		log logging.Logger) (publish.Publisher, error) {
		// confirm that the interpreter paths made it to the publisher factory.
		s.Equal("/bin/my_r", rInterpreter.GetPreferredPath())
		s.Equal("/bin/my_python", pythonInterpreter.GetPreferredPath())
		return publisher, nil
	}
	stateFactory = func(
		path util.AbsolutePath,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList,
		secrets map[string]string,
		insecure bool,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		log logging.Logger,
	) (*state.State, error) {

		s.Equal(s.cwd, path)
		s.Equal("myTargetName", targetName)
		s.Equal("local", accountName)
		s.Equal("default", configName)
		s.Equal("", saveName)

		// confirm that the interpreter paths made it through the request.
		s.Equal("/bin/my_r", rInterpreter.GetPreferredPath())
		s.Equal("/bin/my_python", pythonInterpreter.GetPreferredPath())

		st := state.Empty()
		st.Account = &accounts.Account{}
		st.Account.Insecure = insecure
		st.Target = deployment.New()
		return st, nil
	}
	handler := PostDeploymentHandlerFunc(s.cwd, log, lister, events.NewNullEmitter())
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncBadJSON() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{"random": "123"}`))

	handler := PostDeploymentHandlerFunc(s.cwd, log, nil, events.NewNullEmitter())
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncStateErr() {
	log := logging.New()
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req.Body = io.NopCloser(strings.NewReader("{}"))

	stateFactory = func(
		path util.AbsolutePath,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList,
		secrets map[string]string,
		insecure bool,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		log logging.Logger,
	) (*state.State, error) {
		return nil, errors.New("test error from state factory")
	}

	handler := PostDeploymentHandlerFunc(s.cwd, log, nil, events.NewNullEmitter())
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "test error from state factory")
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncWrongServer() {
	log := logging.New()

	deploymentName := "myDeployment"
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/"+deploymentName, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": deploymentName})

	originalAcct := &accounts.Account{
		URL: "https://connect.example.com",
	}
	newAcct := &accounts.Account{
		URL: "https://some.other.server.com",
	}

	d := deployment.New()
	d.ServerURL = originalAcct.URL
	_, err = d.WriteFile(deployment.GetDeploymentPath(s.cwd, deploymentName), "", s.log)
	s.NoError(err)

	cfg := config.New()
	cfg.Type = config.ContentTypeHTML
	err = cfg.WriteFile(config.GetConfigPath(s.cwd, "default"))
	s.NoError(err)

	lister := &accounts.MockAccountList{}
	lister.On("GetAccountByName", "newAcct").Return(newAcct, nil)

	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "newAcct",
			"config": "default",
			"insecure": false
		}`))

	handler := PostDeploymentHandlerFunc(s.cwd, log, lister, events.NewNullEmitter())
	handler(rec, req)

	s.Equal(http.StatusConflict, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncPublishErr() {
	log := logging.New()
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(`{"account": "local", "config": "default", "insecure": false}`))

	stateFactory = func(
		path util.AbsolutePath,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList,
		secrets map[string]string,
		insecure bool,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		log logging.Logger,
	) (*state.State, error) {

		st := state.Empty()
		st.Account = &accounts.Account{}
		st.Target = deployment.New()
		return st, nil
	}

	testErr := errors.New("test error from PublishDirectory")
	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(testErr)
	publisherFactory = func(*state.State, interpreters.RInterpreter, interpreters.PythonInterpreter, events.Emitter, logging.Logger) (publish.Publisher, error) {
		return publisher, nil
	}

	handler := PostDeploymentHandlerFunc(s.cwd, log, lister, events.NewNullEmitter())
	handler(rec, req)

	// Handler returns 202 Accepted even if publishing errs,
	// because the publish action is asynchronous.
	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentSubdir() {
	log := logging.New()

	// Deployment is in a subdirectory two levels down
	base := s.cwd.Dir().Dir()
	relProjectDir, err := s.cwd.Rel(base)
	s.NoError(err)

	dirParam := url.QueryEscape(relProjectDir.String())
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName?dir="+dirParam, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "local",
			"config": "default",
			"insecure": false
		}`))

	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(nil)
	publisherFactory = func(*state.State, interpreters.RInterpreter, interpreters.PythonInterpreter, events.Emitter, logging.Logger) (publish.Publisher, error) {
		return publisher, nil
	}
	stateFactory = func(
		path util.AbsolutePath,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList,
		secrets map[string]string,
		insecure bool,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		log logging.Logger,
	) (*state.State, error) {

		s.Equal(s.cwd, path)
		s.Equal("myTargetName", targetName)
		s.Equal("local", accountName)
		s.Equal("default", configName)
		s.Equal("", saveName)

		st := state.Empty()
		st.Account = &accounts.Account{}
		st.Target = deployment.New()
		return st, nil
	}
	handler := PostDeploymentHandlerFunc(base, log, lister, events.NewNullEmitter())
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncWithSecrets() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "local",
			"config": "default",
			"insecure": false,
			"secrets": {
				"API_KEY": "secret123",
				"DB_PASSWORD": "password456"
			}
		}`))

	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(nil)
	publisherFactory = func(*state.State, interpreters.RInterpreter, interpreters.PythonInterpreter, events.Emitter, logging.Logger) (publish.Publisher, error) {
		return publisher, nil
	}

	stateFactory = func(
		path util.AbsolutePath,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList,
		secrets map[string]string,
		insecure bool,
		rInterpreter interpreters.RInterpreter,
		pythonInterpreter interpreters.PythonInterpreter,
		log logging.Logger,
	) (*state.State, error) {

		s.Equal(s.cwd, path)
		s.Equal("myTargetName", targetName)
		s.Equal("local", accountName)
		s.Equal("default", configName)
		s.Equal("", saveName)
		s.Equal(map[string]string{
			"API_KEY":     "secret123",
			"DB_PASSWORD": "password456",
		}, secrets)

		st := state.Empty()
		st.Account = &accounts.Account{}
		st.Target = deployment.New()
		return st, nil
	}

	handler := PostDeploymentHandlerFunc(s.cwd, log, lister, events.NewNullEmitter())
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}
