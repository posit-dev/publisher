package cloud_auth

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

type CloudAuthClientSuite struct {
	utiltest.Suite
}

func TestCloudAuthClientSuite(t *testing.T) {
	s := new(CloudAuthClientSuite)
	suite.Run(t, s)
}

func (s *CloudAuthClientSuite) TestNewCloudAuthClient() {
	timeout := 10 * time.Second
	log := logging.New()

	apiClient := NewCloudAuthClient("https://api.staging.login.posit.cloud", log, timeout)
	client := apiClient.(*CloudAuthClient)
	s.NotNil(client.client)
}

func (s *CloudAuthClientSuite) TestCreateDeviceAuth() {
	httpClient := &http_client.MockHTTPClient{}
	expectedResult := &DeviceAuthResponse{
		DeviceCode:              "device_code",
		UserCode:                "user_code",
		VerificationURI:         "https://example.com/verify",
		VerificationURIComplete: "https://example.com/verify?user_code=user_code",
		ExpiresIn:               900,
		Interval:                5,
	}

	httpClient.On("PostForm", "/device_authorization", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*DeviceAuthResponse)
		result.DeviceCode = expectedResult.DeviceCode
		result.UserCode = expectedResult.UserCode
		result.VerificationURI = expectedResult.VerificationURI
		result.VerificationURIComplete = expectedResult.VerificationURIComplete
		result.ExpiresIn = expectedResult.ExpiresIn
		result.Interval = expectedResult.Interval
	}

	request := DeviceAuthRequest{
		ClientID: "client_id",
		Scope:    "scope",
	}
	client := &CloudAuthClient{
		client: httpClient,
		log:    logging.New(),
	}
	result, err := client.CreateDeviceAuth(request)
	s.NoError(err)
	s.Equal(expectedResult, result)
}

func (s *CloudAuthClientSuite) TestExchangeToken() {
	httpClient := &http_client.MockHTTPClient{}
	expectedResult := &TokenResponse{
		AccessToken:  "access_token",
		RefreshToken: "refresh_token",
		ExpiresIn:    3600,
		TokenType:    "Bearer",
		Scope:        "vivid",
	}

	httpClient.On("PostForm", "/oauth/token", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*TokenResponse)
		result.AccessToken = expectedResult.AccessToken
		result.RefreshToken = expectedResult.RefreshToken
		result.ExpiresIn = expectedResult.ExpiresIn
		result.TokenType = expectedResult.TokenType
		result.Scope = expectedResult.Scope
	}

	request := TokenRequest{
		GrantType:  "grant_type",
		DeviceCode: "device_code",
		ClientID:   "client_id",
	}
	client := &CloudAuthClient{
		client: httpClient,
		log:    logging.New(),
	}
	result, err := client.ExchangeToken(request)
	s.NoError(err)
	s.Equal(expectedResult, result)
}
