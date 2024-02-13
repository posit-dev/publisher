package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostDeploymentHandlerFuncSuite struct {
	utiltest.Suite
	cwd util.Path
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
}

type mockPublisher struct {
	mock.Mock
}

func (m *mockPublisher) PublishDirectory(log logging.Logger) error {
	args := m.Called(log)
	return args.Error(0)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFunc() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": "myTargetName"})

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "local",
			"config": "default"
		}`))

	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(nil)
	publisherFactory = func(*state.State, events.Emitter) (publish.Publisher, error) {
		return publisher, nil
	}
	stateFactory = func(
		path util.Path,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList) (*state.State, error) {
		s.Equal("myTargetName", targetName)
		s.Equal("local", accountName)
		s.Equal("default", configName)
		s.Equal("", saveName)
		return state.Empty(), nil
	}
	handler := PostDeploymentHandlerFunc(util.Path{}, log, lister, events.NewNullEmitter())
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncBadJSON() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{"random": "123"}`))

	handler := PostDeploymentHandlerFunc(util.Path{}, log, nil, events.NewNullEmitter())
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
		path util.Path,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList) (*state.State, error) {
		return nil, errors.New("test error from state factory")
	}

	handler := PostDeploymentHandlerFunc(util.Path{}, log, nil, events.NewNullEmitter())
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentHandlerFuncSuite) TestPostDeploymentHandlerFuncPublishErr() {
	log := logging.New()
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/deployments/myTargetName", nil)
	s.NoError(err)

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(`{"account": "local", "config": "default"}`))

	stateFactory = func(
		path util.Path,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList) (*state.State, error) {
		return state.Empty(), nil
	}

	testErr := errors.New("test error from PublishDirectory")
	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(testErr)
	publisherFactory = func(*state.State, events.Emitter) (publish.Publisher, error) {
		return publisher, nil
	}

	handler := PostDeploymentHandlerFunc(util.Path{}, log, lister, events.NewNullEmitter())
	handler(rec, req)

	// Handler returns 202 Accepted even if publishing errs,
	// because the publish action is asynchronous.
	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}
