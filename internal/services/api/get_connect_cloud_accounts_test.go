package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/types"
	"io"
	"net/http"
	"net/http/httptest"
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
	accountRoles := map[string]connect_cloud.UserAccountRole{
		"account1": {
			Role: "owner",
			Account: connect_cloud.UserAccountRoleAccount{
				Name: "Account 1",
			},
		},
		"account2": {
			Role: "publisher",
			Account: connect_cloud.UserAccountRoleAccount{
				Name: "Account 2",
			},
		},
		"account3": {
			Role: "user",
			Account: connect_cloud.UserAccountRoleAccount{
				Name: "Account 3",
			},
		},
	}
	userResponse := &connect_cloud.UserResponse{
		AccountRoles: accountRoles,
	}
	client.On("GetCurrentUser").Return(userResponse, nil)

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
	s.Equal(http.StatusOK, result.StatusCode)
	respBody, _ := io.ReadAll(rec.Body)
	// The expected response should include all accounts, with PermissionToPublish
	// set to true for owner and publisher roles, false otherwise
	s.JSONEq(`{
		"accounts": [
			{
				"id": "account1",
				"name": "Account 1",
				"permissionToPublish": true
			},
			{
				"id": "account2",
				"name": "Account 2",
				"permissionToPublish": true
			},
			{
				"id": "account3",
				"name": "Account 3",
				"permissionToPublish": false
			}
		]
	}`, string(respBody))
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_MissingBaseURL() {
	rec := httptest.NewRecorder()
	req, err := http.NewRequest(
		"GET",
		"/connect-cloud/accounts",
		nil,
	)
	s.NoError(err)
	// Not setting Cloud-Auth-Base-Url header

	s.h(rec, req)

	result := rec.Result()
	s.Equal(http.StatusBadRequest, result.StatusCode)
}

func (s *GetConnectCloudAccountsSuite) TestGetConnectCloudAccounts_GetCurrentUserError() {
	client := connect_cloud.NewMockClient()
	client.On("GetCurrentUser").Return((*connect_cloud.UserResponse)(nil), types.NewAgentError(
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
