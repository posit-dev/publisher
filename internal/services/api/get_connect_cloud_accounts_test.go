package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/types"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type GetConnectCloudAccountsSuite struct {
	utiltest.Suite
	log logging.Logger
	h   http.HandlerFunc
}

func TestGetConnectCloudAccountsSuite(t *testing.T) {
	suite.Run(t, new(GetConnectCloudAccountsSuite))
}

func (s *GetConnectCloudAccountsSuite) SetupSuite() {
	s.log = logging.New()
}

func (s *GetConnectCloudAccountsSuite) SetupTest() {
	s.h = GetConnectCloudAccountsFunc(s.log)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts() {
	client := connect_cloud.NewMockClient()

	// Mock the GetCurrentUser call
	userResponse := &connect_cloud.UserResponse{}
	client.On("GetCurrentUser").Return(userResponse, nil)

	// Mock the GetAccounts call
	accountsResponse := &connect_cloud.AccountListResponse{
		Data: []connect_cloud.Account{
			{
				ID:          "account1",
				Name:        "Account 1",
				Permissions: []string{"content:create"},
			},
			{
				ID:          "account2",
				Name:        "Account 2",
				Permissions: []string{"content:create"},
			},
			{
				ID:          "account3",
				Name:        "Account 3",
				Permissions: []string{},
			},
		},
	}
	client.On("GetAccounts").Return(accountsResponse, nil)

	connectCloudClientFactory = func(baseURL string, log logging.Logger, timeout time.Duration, authValue string) connect_cloud.APIClient {
		return client
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set("Connect-Cloud-Base-Url", "https://api.login.staging.posit.cloud")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusOK, result.StatusCode)

	respBody, _ := io.ReadAll(rec.Body)
	respMap := map[string]interface{}{}
	err = json.Unmarshal(respBody, &respMap)
	s.NoError(err)

	// sort accounts by ID to ensure consistent order for testing
	slices.SortFunc(respMap["accounts"].([]interface{}), func(a, b interface{}) int {
		return strings.Compare(
			a.(map[string]interface{})["name"].(string),
			b.(map[string]interface{})["name"].(string))
	})

	// The expected response should include all accounts, with PermissionToPublish
	// set to true for accounts with "content:create" permission, false otherwise
	s.Equal(map[string]interface{}{
		"accounts": []interface{}{
			map[string]interface{}{
				"id":                  "account1",
				"name":                "Account 1",
				"permissionToPublish": true,
			},
			map[string]interface{}{
				"id":                  "account2",
				"name":                "Account 2",
				"permissionToPublish": true,
			},
			map[string]interface{}{
				"id":                  "account3",
				"name":                "Account 3",
				"permissionToPublish": false,
			},
		},
	}, respMap)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_MissingBaseURL() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	// Not setting Connect-Cloud-Base-Url header

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusBadRequest, result.StatusCode)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_GetCurrentUserError() {
	client := connect_cloud.NewMockClient()
	client.On("GetCurrentUser").Return((*connect_cloud.UserResponse)(nil), types.NewAgentError(
		events.ServerErrorCode,
		http_client.NewHTTPError("https://foo.bar", "GET", http.StatusBadRequest), nil))
	// No need to mock GetAccounts since the function returns after GetCurrentUser fails

	connectCloudClientFactory = func(baseURL string, log logging.Logger, timeout time.Duration, authValue string) connect_cloud.APIClient {
		return client
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set(connectCloudBaseURLHeader, "https://api.login.staging.posit.cloud")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusInternalServerError, result.StatusCode)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_GetAccountsError() {
	client := connect_cloud.NewMockClient()
	// Mock successful GetCurrentUser call
	userResponse := &connect_cloud.UserResponse{}
	client.On("GetCurrentUser").Return(userResponse, nil)

	// Mock GetAccounts with error
	client.On("GetAccounts").Return((*connect_cloud.AccountListResponse)(nil), types.NewAgentError(
		events.ServerErrorCode,
		http_client.NewHTTPError("https://foo.bar", "GET", http.StatusBadRequest), nil))

	connectCloudClientFactory = func(baseURL string, log logging.Logger, timeout time.Duration, authValue string) connect_cloud.APIClient {
		return client
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set(connectCloudBaseURLHeader, "https://api.login.staging.posit.cloud")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusInternalServerError, result.StatusCode)
}
