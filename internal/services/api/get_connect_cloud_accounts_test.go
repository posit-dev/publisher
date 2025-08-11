package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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
				ID:          "1",
				Name:        "account1",
				DisplayName: "Account 1",
				Permissions: []string{"content:create"},
			},
			{
				ID:          "2",
				Name:        "account2",
				DisplayName: "Account 2",
				Permissions: []string{"content:create"},
			},
			{
				ID:          "3",
				Name:        "account3",
				DisplayName: "Account 3",
				Permissions: []string{},
			},
		},
	}
	client.On("GetAccounts").Return(accountsResponse, nil)

	connectCloudClientFactory = func(environment types.CloudEnvironment, log logging.Logger, timeout time.Duration, account *accounts.Account, authValue string) (connect_cloud.APIClient, error) {
		return client, nil
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set("Connect-Cloud-Environment", "staging")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusOK, result.StatusCode)

	respBody, _ := io.ReadAll(rec.Body)
	var respData []interface{}
	err = json.Unmarshal(respBody, &respData)
	s.NoError(err)

	// sort accounts by ID to ensure consistent order for testing
	slices.SortFunc(respData, func(a, b interface{}) int {
		return strings.Compare(
			a.(map[string]interface{})["name"].(string),
			b.(map[string]interface{})["name"].(string))
	})

	// The expected response should include all accounts, with PermissionToPublish
	// set to true for accounts with "content:create" permission, false otherwise
	s.Equal([]interface{}{
		map[string]interface{}{
			"id":                  "1",
			"name":                "account1",
			"displayName":         "Account 1",
			"permissionToPublish": true,
		},
		map[string]interface{}{
			"id":                  "2",
			"name":                "account2",
			"displayName":         "Account 2",
			"permissionToPublish": true,
		},
		map[string]interface{}{
			"id":                  "3",
			"name":                "account3",
			"displayName":         "Account 3",
			"permissionToPublish": false,
		},
	}, respData)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_GetCurrentUserError() {
	client := connect_cloud.NewMockClient()
	client.On("GetCurrentUser").Return((*connect_cloud.UserResponse)(nil), types.NewAgentError(
		events.ServerErrorCode,
		http_client.NewHTTPError("https://foo.bar", "GET", http.StatusBadRequest, "uh oh"), nil))
	// No need to mock GetAccounts since the function returns after GetCurrentUser fails

	connectCloudClientFactory = func(environment types.CloudEnvironment, log logging.Logger, timeout time.Duration, account *accounts.Account, authValue string) (connect_cloud.APIClient, error) {
		return client, nil
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set("Connect-Cloud-Environment", "staging")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusInternalServerError, result.StatusCode)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_NoUserForLucidUser() {
	client := connect_cloud.NewMockClient()

	// Setup the error to simulate "no_user_for_lucid_user" error
	errorData := map[string]interface{}{"error_type": "no_user_for_lucid_user"}
	httpErr := http_client.NewHTTPError("https://foo.bar", "GET", http.StatusUnauthorized, "uh oh")
	agentErr := types.NewAgentError(events.ServerErrorCode, httpErr, errorData)

	// Mock the GetCurrentUser call to return the no_user_for_lucid_user error
	client.On("GetCurrentUser").Return((*connect_cloud.UserResponse)(nil), agentErr)

	connectCloudClientFactory = func(environment types.CloudEnvironment, log logging.Logger, timeout time.Duration, account *accounts.Account, authValue string) (connect_cloud.APIClient, error) {
		return client, nil
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set(connectCloudEnvironmentHeader, "staging")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	// Verify the response status code and body
	result := rec.Result()
	s.Equal(http.StatusOK, result.StatusCode)
	s.NoError(err)

	respBody, _ := io.ReadAll(rec.Body)
	accounts := []any{}
	err = json.Unmarshal(respBody, &accounts)
	s.NoError(err)

	// Verify the response contains an account array with zero length
	s.Len(accounts, 0)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_GetAccountsError() {
	client := connect_cloud.NewMockClient()
	// Mock successful GetCurrentUser call
	userResponse := &connect_cloud.UserResponse{}
	client.On("GetCurrentUser").Return(userResponse, nil)

	// Mock GetAccounts with error
	client.On("GetAccounts").Return((*connect_cloud.AccountListResponse)(nil), types.NewAgentError(
		events.ServerErrorCode,
		http_client.NewHTTPError("https://foo.bar", "GET", http.StatusBadRequest, "uh oh"), nil))

	connectCloudClientFactory = func(_ types.CloudEnvironment, _ logging.Logger, _ time.Duration, _ *accounts.Account, _ string) (connect_cloud.APIClient, error) {
		return client, nil
	}

	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	req.Header.Set("Connect-Cloud-Environment", "staging")
	req.Header.Set("Authorization", "Bearer token123")

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusInternalServerError, result.StatusCode)
}
