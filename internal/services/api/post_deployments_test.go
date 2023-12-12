package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostDeploymentsHandlerFuncSuite struct {
	utiltest.Suite
	cwd util.Path
}

func TestPostDeploymentsHandlerFuncSuite(t *testing.T) {
	suite.Run(t, new(PostDeploymentsHandlerFuncSuite))
}

func (s *PostDeploymentsHandlerFuncSuite) SetupTest() {
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

func (s *PostDeploymentsHandlerFuncSuite) TestPostDeploymentsHandlerFunc() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	lister := &accounts.MockAccountList{}
	req.Body = io.NopCloser(strings.NewReader(
		`{
			"account": "local",
			"config": "default"
		}`))

	publisher := &mockPublisher{}
	publisher.On("PublishDirectory", mock.Anything).Return(nil)
	publisherFactory = func(*state.State) publish.Publisher {
		return publisher
	}
	stateFactory = func(
		path util.Path,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList) (*state.State, error) {
		s.Equal("local", accountName)
		s.Equal("default", configName)
		return state.Empty(), nil
	}
	handler := PostDeploymentsHandlerFunc(util.Path{}, log, lister)
	handler(rec, req)

	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
	s.Equal("application/json", rec.Header().Get("content-type"))

	res := &PostPublishReponse{}
	dec := json.NewDecoder(rec.Body)
	dec.DisallowUnknownFields()
	s.NoError(dec.Decode(res))
}

func (s *PostDeploymentsHandlerFuncSuite) TestPostDeploymentsHandlerFuncBadJSON() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{"random": "123"}`))

	handler := PostDeploymentsHandlerFunc(util.Path{}, log, nil)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentsHandlerFuncSuite) TestPostDeploymentsHandlerFuncBadSaveAsName() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(`{"saveName": "a/b"}`))

	handler := PostDeploymentsHandlerFunc(util.Path{}, log, nil)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentsHandlerFuncSuite) TestPostDeploymentsHandlerFuncStateErr() {
	log := logging.New()
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
	s.NoError(err)
	req.Body = io.NopCloser(strings.NewReader("{}"))

	stateFactory = func(
		path util.Path,
		accountName, configName, targetName, saveName string,
		accountList accounts.AccountList) (*state.State, error) {
		return nil, errors.New("test error from state factory")
	}

	handler := PostDeploymentsHandlerFunc(util.Path{}, log, nil)
	handler(rec, req)
	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
}

func (s *PostDeploymentsHandlerFuncSuite) TestPostDeploymentsHandlerFuncPublishErr() {
	log := logging.New()
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/publish", nil)
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
	publisherFactory = func(*state.State) publish.Publisher {
		return publisher
	}

	handler := PostDeploymentsHandlerFunc(util.Path{}, log, lister)
	handler(rec, req)

	// Handler returns 202 Accepted even if publishing errs,
	// because the publish action is asynchronous.
	s.Equal(http.StatusAccepted, rec.Result().StatusCode)
}
