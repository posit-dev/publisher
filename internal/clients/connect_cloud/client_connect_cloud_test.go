package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/types"

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

	apiClient := NewConnectCloudClientWithAuth(types.CloudEnvironmentStaging, log, timeout, "Bearer the_token")
	client := apiClient.(*ConnectCloudClient)
	s.NotNil(client.client)
}

func (s *ConnectCloudClientSuite) TestGetCurrentUser() {
	httpClient := &http_client.MockHTTPClient{}

	httpClient.On("Get", "/v1/users/me", mock.Anything, mock.Anything, mock.Anything).
		Return(nil)
	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}
	_, err := client.GetCurrentUser()
	s.NoError(err)
}
