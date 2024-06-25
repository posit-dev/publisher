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
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostTestCredentialsHandlerSuite struct {
	utiltest.Suite
}

func TestPostTestCredentialsHandlerSuite(t *testing.T) {
	suite.Run(t, new(PostTestCredentialsHandlerSuite))
}

func (s *PostTestCredentialsHandlerSuite) SetupTest() {
	clientFactory = connect.NewConnectClient
}

func (s *PostTestCredentialsHandlerSuite) TestPostTestCredentialsHandlerFunc() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/test-credentials", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(
		`{
			"url": "https://connect.example.com",
			"apiKey": "0123456789abcdef0123456789abcdef"
		}`))

	client := connect.NewMockClient()
	user := &connect.User{
		Email: "user@example.com",
	}
	client.On("TestAuthentication", mock.Anything).Return(user, nil)
	clientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}
	handler := PostTestCredentialsHandlerFunc(log)
	handler(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var response PostTestCredentialsResponseBody
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	s.NoError(err)
	s.Equal(user, response.User)
	s.Nil(response.Error)
}

func (s *PostTestCredentialsHandlerSuite) TestPostTestCredentialsHandlerFuncNoApiKey() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/test-credentials", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(
		`{
			"url": "https://connect.example.com"
		}`))

	client := connect.NewMockClient()
	client.On("TestAuthentication", mock.Anything).Return(nil, nil)
	clientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}
	handler := PostTestCredentialsHandlerFunc(log)
	handler(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var response PostTestCredentialsResponseBody
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	s.NoError(err)
	s.Nil(response.User)
	s.Nil(response.Error)
}

func (s *PostTestCredentialsHandlerSuite) TestPostTestCredentialsHandlerFuncBadApiKey() {
	log := logging.New()

	rec := httptest.NewRecorder()
	req, err := http.NewRequest("POST", "/api/test-credentials", nil)
	s.NoError(err)

	req.Body = io.NopCloser(strings.NewReader(
		`{
			"url": "https://connect.example.com",
			"apiKey": "invalid"
		}`))

	testError := errors.New("test error from TestAuthentication")
	client := connect.NewMockClient()
	client.On("TestAuthentication", mock.Anything).Return(nil, testError)
	clientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return client, nil
	}
	handler := PostTestCredentialsHandlerFunc(log)
	handler(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	var response PostTestCredentialsResponseBody
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	s.NoError(err)
	s.Nil(response.User)
	s.NotNil(response.Error)
	s.Equal(testError.Error(), response.Error.Message)
}
