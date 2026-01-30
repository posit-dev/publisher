package api

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type PostOpenConnectContentSuite struct {
	suite.Suite
	log                   *loggingtest.MockLogger
	accountList           *accounts.MockAccountList
	mockClient            *connect.MockClient
	originalClientFactory func(*accounts.Account, time.Duration, events.Emitter, logging.Logger) (connect.APIClient, error)
}

func TestPostOpenConnectContentSuite(t *testing.T) {
	suite.Run(t, new(PostOpenConnectContentSuite))
}

func (s *PostOpenConnectContentSuite) SetupTest() {
	s.log = loggingtest.NewMockLogger()
	s.log.On("Error", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()
	s.log.On("Debug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()
	s.log.On("Info", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()

	s.accountList = accounts.NewMockAccountList()
	s.mockClient = connect.NewMockClient()

	s.originalClientFactory = connectOpenClientFactory
}

func (s *PostOpenConnectContentSuite) TearDownTest() {
	connectOpenClientFactory = s.originalClientFactory
}

func (s *PostOpenConnectContentSuite) TestSuccess() {
	testAccount := accounts.Account{
		URL:    "https://connect.example.com",
		ApiKey: "test-api-key",
	}
	s.accountList.On("GetAllAccounts").Return([]accounts.Account{testAccount}, nil)

	expectedBundle := []byte("fake-gzip-bundle-content")
	s.mockClient.On("LatestBundleID", types.ContentID("test-guid"), mock.Anything).Return(types.BundleID("bundle-123"), nil)
	s.mockClient.On("DownloadBundle", types.ContentID("test-guid"), types.BundleID("bundle-123"), mock.Anything).Return(expectedBundle, nil)

	connectOpenClientFactory = func(*accounts.Account, time.Duration, events.Emitter, logging.Logger) (connect.APIClient, error) {
		return s.mockClient, nil
	}

	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL:   "https://connect.example.com",
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("application/gzip", rec.Header().Get("Content-Type"))
	s.Equal(expectedBundle, rec.Body.Bytes())

	s.accountList.AssertExpectations(s.T())
	s.mockClient.AssertExpectations(s.T())
}

func (s *PostOpenConnectContentSuite) TestMissingServerURL() {
	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusBadRequest, rec.Code)
}

func (s *PostOpenConnectContentSuite) TestMissingContentGUID() {
	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL: "https://connect.example.com",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusBadRequest, rec.Code)
}

func (s *PostOpenConnectContentSuite) TestNoMatchingAccount() {
	s.accountList.On("GetAllAccounts").Return([]accounts.Account{}, nil)

	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL:   "https://connect.example.com",
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusNotFound, rec.Code)
}

func (s *PostOpenConnectContentSuite) TestAccountWithoutCredentials() {
	testAccount := accounts.Account{
		URL: "https://connect.example.com",
		// No ApiKey - no credentials
	}
	s.accountList.On("GetAllAccounts").Return([]accounts.Account{testAccount}, nil)

	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL:   "https://connect.example.com",
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusNotFound, rec.Code)
}

func (s *PostOpenConnectContentSuite) TestLatestBundleIDError() {
	testAccount := accounts.Account{
		URL:    "https://connect.example.com",
		ApiKey: "test-api-key",
	}
	s.accountList.On("GetAllAccounts").Return([]accounts.Account{testAccount}, nil)

	s.mockClient.On("LatestBundleID", types.ContentID("test-guid"), mock.Anything).Return(types.BundleID(""), &types.AgentError{
		Code:    events.AuthenticationFailedCode,
		Message: "invalid credentials",
	})

	connectOpenClientFactory = func(*accounts.Account, time.Duration, events.Emitter, logging.Logger) (connect.APIClient, error) {
		return s.mockClient, nil
	}

	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL:   "https://connect.example.com",
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusUnauthorized, rec.Code)
}

func (s *PostOpenConnectContentSuite) TestDownloadBundlePermissionError() {
	testAccount := accounts.Account{
		URL:    "https://connect.example.com",
		ApiKey: "test-api-key",
	}
	s.accountList.On("GetAllAccounts").Return([]accounts.Account{testAccount}, nil)

	s.mockClient.On("LatestBundleID", types.ContentID("test-guid"), mock.Anything).Return(types.BundleID("bundle-123"), nil)
	s.mockClient.On("DownloadBundle", types.ContentID("test-guid"), types.BundleID("bundle-123"), mock.Anything).Return(nil, &types.AgentError{
		Code:    events.PermissionsCode,
		Message: "access denied",
	})

	connectOpenClientFactory = func(*accounts.Account, time.Duration, events.Emitter, logging.Logger) (connect.APIClient, error) {
		return s.mockClient, nil
	}

	handler := PostOpenConnectContentHandlerFunc(s.accountList, s.log, events.NewNullEmitter())

	body, _ := json.Marshal(PostOpenConnectContentRequestBody{
		ServerURL:   "https://connect.example.com",
		ContentGUID: "test-guid",
	})
	req := httptest.NewRequest("POST", "/api/open-connect-content", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler(rec, req)

	s.Equal(http.StatusForbidden, rec.Code)
}
