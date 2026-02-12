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
	"github.com/posit-dev/publisher/internal/clients/connect/server_settings"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type GetServerSettingsSuite struct {
	utiltest.Suite
	log logging.Logger
}

func TestGetServerSettingsSuite(t *testing.T) {
	suite.Run(t, new(GetServerSettingsSuite))
}

func (s *GetServerSettingsSuite) SetupTest() {
	s.log = logging.New()
	// reset factory in case prior tests mutated it
	connectClientFactory = connect.NewConnectClient
}

func (s *GetServerSettingsSuite) newRequest(accountName string) (*httptest.ResponseRecorder, *http.Request) {
	return s.newRequestWithContentType(accountName, "")
}

func (s *GetServerSettingsSuite) newRequestWithContentType(accountName string, contentType string) (*httptest.ResponseRecorder, *http.Request) {
	rec := httptest.NewRecorder()
	url := fmt.Sprintf("/api/accounts/%s/server-settings", accountName)
	if contentType != "" {
		url += "?type=" + contentType
	}
	req, err := http.NewRequest("GET", url, nil)
	s.NoError(err)
	req = mux.SetURLVars(req, map[string]string{"name": accountName})
	return rec, req
}

func (s *GetServerSettingsSuite) TestGetServerSettingsSuccess() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: server_type.ServerTypeConnect,
	}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	mockClient := &connect.MockClient{}
	expectedSettings := &connect.AllSettings{
		General: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				OAuthIntegrations: true,
			},
			OAuthIntegrationsEnabled: true,
		},
	}
	mockClient.On("GetSettings", mock.Anything, mock.Anything, mock.Anything).Return(expectedSettings, nil)

	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("myAccount")
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	var got server_settings.ServerSettings
	s.NoError(json.Unmarshal(body, &got))
	s.Equal(expectedSettings.General.OAuthIntegrationsEnabled, got.OAuthIntegrationsEnabled)
	s.Equal(expectedSettings.General.License.OAuthIntegrations, got.License.OAuthIntegrations)
}

func (s *GetServerSettingsSuite) TestGetServerSettingsAccountNotFound() {
	lister := &accounts.MockAccountList{}
	lister.On("GetAccountByName", "missing").Return(nil, accounts.ErrAccountNotFound)

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("missing")
	h(rec, req)

	s.Equal(http.StatusNotFound, rec.Result().StatusCode)
}

func (s *GetServerSettingsSuite) TestGetServerSettingsClientError() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{Name: "badAccount", URL: "https://x"}
	lister.On("GetAccountByName", "badAccount").Return(acct, nil)
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return nil, errors.New("client init failure")
	}

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("badAccount")
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
}

func (s *GetServerSettingsSuite) TestGetServerSettingsGetSettingsError() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{Name: "errAccount", URL: "https://x"}
	lister.On("GetAccountByName", "errAccount").Return(acct, nil)

	mockClient := &connect.MockClient{}
	mockClient.On("GetSettings", mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("settings error"))
	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("errAccount")
	h(rec, req)

	s.Equal(http.StatusInternalServerError, rec.Result().StatusCode)
	body, _ := io.ReadAll(rec.Body)
	s.Contains(string(body), "settings error")
}

func (s *GetServerSettingsSuite) TestGetServerSettingsWithContentType() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: server_type.ServerTypeConnect,
	}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	mockClient := &connect.MockClient{}
	expectedSettings := &connect.AllSettings{
		General: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				OAuthIntegrations: true,
			},
			OAuthIntegrationsEnabled: true,
		},
	}
	// Verify that GetSettings is called with a config that has the correct content type
	mockClient.On("GetSettings", mock.Anything, mock.MatchedBy(func(cfg *config.Config) bool {
		return cfg.Type == contenttypes.ContentTypePythonFastAPI
	}), mock.Anything).Return(expectedSettings, nil)

	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequestWithContentType("myAccount", "python-fastapi")
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	mockClient.AssertExpectations(s.T())
}

func (s *GetServerSettingsSuite) TestGetServerSettingsWithoutContentType() {
	lister := &accounts.MockAccountList{}
	acct := &accounts.Account{
		Name:       "myAccount",
		URL:        "https://connect.example.com",
		ServerType: server_type.ServerTypeConnect,
	}
	lister.On("GetAccountByName", "myAccount").Return(acct, nil)

	mockClient := &connect.MockClient{}
	expectedSettings := &connect.AllSettings{
		General: server_settings.ServerSettings{
			License: server_settings.LicenseStatus{
				OAuthIntegrations: true,
			},
			OAuthIntegrationsEnabled: true,
		},
	}
	// Verify that GetSettings is called with a config that has ContentTypeUnknown when no type param is provided
	mockClient.On("GetSettings", mock.Anything, mock.MatchedBy(func(cfg *config.Config) bool {
		return cfg.Type == contenttypes.ContentTypeUnknown
	}), mock.Anything).Return(expectedSettings, nil)

	connectClientFactory = func(account *accounts.Account, timeout time.Duration, emitter events.Emitter, log logging.Logger) (connect.APIClient, error) {
		return mockClient, nil
	}

	h := GetServerSettingsHandlerFunc(lister, s.log)
	rec, req := s.newRequest("myAccount")
	h(rec, req)

	s.Equal(http.StatusOK, rec.Result().StatusCode)
	mockClient.AssertExpectations(s.T())
}
