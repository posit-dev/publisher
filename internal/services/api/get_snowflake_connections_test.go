package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type GetSnowflakeConnectionsHandlerSuite struct {
	utiltest.Suite
}

func TestGetSnowflakeConnectionsHandlerSuite(t *testing.T) {
	suite.Run(t, new(GetSnowflakeConnectionsHandlerSuite))
}

func (s *GetSnowflakeConnectionsHandlerSuite) SetupTest() {
	connectClientFactory = connect.NewConnectClient
}

func (s *GetSnowflakeConnectionsHandlerSuite) TestGetSnowflakeConnectionsHandlerFunc() {
	log := logging.New()

	connections := &snowflake.MockConnections{}
	connections.On("List").Return(map[string]*snowflake.Connection{
		// this handler only uses the connection names, so we don't have
		// to define the actual connections
		"one": {},
		"two": {},
	}, nil)

	v := url.Values{}
	v.Add("serverUrl", "https://example.snowflakecomputing.app/connect/#/content")
	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		fmt.Sprintf("/api/snowflake-connections?%s", v.Encode()),
		nil,
	)
	s.NoError(err)

	// overcomplicating this with one mock client per connection name
	// because the order of map iteration is not guaranteed, leading to
	// flakiness if we assume "one" comes before "two" D:
	clients := map[string]*connect.MockClient{
		"one": connect.NewMockClient(),
		"two": connect.NewMockClient(),
	}
	// "one" succeeds on the first try, and does not try additional URLs
	clients["one"].On("TestAuthentication", log).Return(&connect.User{}, nil).Once()
	// "two" fails, and tries again with an added path element and fails again
	clients["two"].On("TestAuthentication", log).Return(nil, errors.New("unauth")).Twice()
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		// developer error if not:
		s.Contains(clients, account.SnowflakeConnection)
		return clients[account.SnowflakeConnection], nil
	}

	handler := GetSnowflakeConnectionsHandlerFunc(log, connections)
	handler(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)

	// response contains "one", the connection that was successful
	var response []getSnowflakeConnectionsResponseBody
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	s.NoError(err)
	s.Len(response, 1)
	s.Equal("one", response[0].Name)
	// the returned URL is the first one that succeeded, not identical to
	// the one that was passed in
	s.Equal("https://example.snowflakecomputing.app", response[0].ServerUrl)
}

func (s *GetSnowflakeConnectionsHandlerSuite) TestGetSnowflakeConnectionsHandlerFuncErrs() {
	log := logging.New()
	connections := &snowflake.MockConnections{}

	// bad server URL
	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/api/snowflake-connections?serverUrl=:bad",
		nil,
	)
	s.NoError(err)

	handler := GetSnowflakeConnectionsHandlerFunc(log, connections)
	handler(rec, req)

	s.Equal(http.StatusBadRequest, rec.Result().StatusCode)
	s.Equal("Bad Request: parse \":bad\": missing protocol scheme\n", rec.Body.String())

	// error loading snowflake connections
	rec = httptest.NewRecorder()
	req, err = http.NewRequest(
		"GET",
		"/api/snowflake-connections?serverUrl=https://example.snowflakecomputing.app",
		nil,
	)
	s.NoError(err)

	connections.On("List").Return(map[string]*snowflake.Connection(nil), errors.New("conn error")).Once()
	handler(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
	s.Equal("conn error", rec.Body.String())

	// unexpected error when building client
	rec = httptest.NewRecorder()
	req, err = http.NewRequest(
		"GET",
		"/api/snowflake-connections?serverUrl=https://example.snowflakecomputing.app",
		nil,
	)
	s.NoError(err)
	connections.On("List").Return(map[string]*snowflake.Connection{
		// this handler only uses the connection names, so we don't have
		// to define the actual connections
		"one": {},
	}, nil)
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return nil, errors.New("client error")
	}
	handler(rec, req)
	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
	s.Equal("client error", rec.Body.String())
}
