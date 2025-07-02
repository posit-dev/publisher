package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type ConnectCloudClientSuite struct {
	utiltest.Suite
}

func TestConnectCloudClientSuite(t *testing.T) {
	s := new(ConnectCloudClientSuite)
	suite.Run(t, s)
}

func (s *ConnectCloudClientSuite) TestNewConnectCloudClient() {
	timeout := 10 * time.Second
	log := logging.New()

	apiClient := NewConnectCloudClientWithAuth("https://api.staging.login.posit.cloud", log, timeout, "Bearer the_token")
	client := apiClient.(*ConnectCloudClient)
	s.NotNil(client.client)
}

func (s *ConnectCloudClientSuite) TestGetCurrentUser() {
	httpClient := &http_client.MockHTTPClient{}
	expectedResult := &UserResponse{
		AccountRoles: map[string]UserAccountRole{
			"account1": {
				Role: "admin",
				Account: UserAccountRoleAccount{
					Name: "Account 1",
				},
			},
			"account2": {
				Role: "admin",
				Account: UserAccountRoleAccount{
					Name: "Account 2",
				},
			},
		},
	}

	httpClient.On("Get", "/v1/users/me", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(1).(*UserResponse)
		result.AccountRoles = expectedResult.AccountRoles
	}
	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}
	result, err := client.GetCurrentUser()
	s.NoError(err)
	s.Equal(expectedResult, result)
}
