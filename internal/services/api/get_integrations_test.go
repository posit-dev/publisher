package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type GetIntegrationsSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestGetIntegrationsSuite(t *testing.T) {
	suite.Run(t, new(GetIntegrationsSuite))
}

func (s *GetIntegrationsSuite) SetupTest() {
	s.log = logging.New()
	connectClientFactory = connect.NewConnectClient
}

func (s *GetIntegrationsSuite) newRequest(accountName string) (*httptest.ResponseRecorder, *http.Request) {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest("GET", fmt.Sprintf("/api/accounts/%s/integrations", accountName), nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": accountName})
	return rec, req
}

func (s *GetIntegrationsSuite) TestGetIntegrationsSuccess() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name: "acct1",
		URL:  "https://connect.example.com",
	}
	lister.On("GetAccountByName", "acct1").Return(acct, nil)

	mockClient := &connect.MockClient{}
	expected := []map[string]any{
		{"name": "github", "enabled": true},
		{"name": "azure", "enabled": false},
	}
	mockClient.On("GetIntegrations", mock.Anything).Return(expected, nil)

	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetIntegrationsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("acct1")
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	var got []map[string]any
	s.NoError(json.Unmarshal(body, &got))
	s.Len(got, 2)
	s.Equal("github", got[0]["name"])
	s.Equal("azure", got[1]["name"])
}

func (s *GetIntegrationsSuite) TestGetIntegrationsAccountNotFound() {
	lister := &accounts.MockAccountList{}
	lister.On("GetAccountByName", "missing").Return(nil, accounts.ErrAccountNotFound)

	h := GetIntegrationsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("missing")
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetIntegrationsSuite) TestGetIntegrationsClientInitError() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{Name: "bad", URL: "https://x"}
	lister.On("GetAccountByName", "bad").Return(acct, nil)

	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return nil, errors.New("init failure")
	}

	h := GetIntegrationsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("bad")
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *GetIntegrationsSuite) TestGetIntegrationsFetchError() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{Name: "err", URL: "https://x"}
	lister.On("GetAccountByName", "err").Return(acct, nil)

	mockClient := &connect.MockClient{}
	mockClient.On("GetIntegrations", mock.Anything).Return(nil, errors.New("integrations error"))
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetIntegrationsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("err")
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "integrations error")
}
