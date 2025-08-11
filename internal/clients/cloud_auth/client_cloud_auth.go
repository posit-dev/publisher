package cloud_auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"net/url"
	"time"

	"github.com/posit-dev/publisher/internal/types"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
)

const clientIDDevelopment = "posit-publisher-development"
const clientIDStaging = "posit-publisher-staging"
const clientIDProduction = "posit-publisher"

const baseURLStaging = "https://login.staging.posit.cloud"
const baseURLProduction = "https://login.posit.cloud"

type CloudAuthClient struct {
	log      logging.Logger
	client   http_client.HTTPClient
	baseURL  string
	clientID string
}

func NewCloudAuthClient(
	environment types.CloudEnvironment,
	log logging.Logger,
	timeout time.Duration) APIClient {
	baseURL, clientID := getBaseURLAndClientID(environment)
	httpClient := http_client.NewBasicHTTPClient(baseURL, timeout)

	return &CloudAuthClient{
		log:      log,
		client:   httpClient,
		baseURL:  baseURL,
		clientID: clientID,
	}
}

func getBaseURLAndClientID(environment types.CloudEnvironment) (string, string) {
	switch environment {
	case types.CloudEnvironmentDevelopment:
		return baseURLStaging, clientIDDevelopment
	case types.CloudEnvironmentStaging:
		return baseURLStaging, clientIDStaging
	default:
		return baseURLProduction, clientIDProduction
	}
}

func (c CloudAuthClient) CreateDeviceAuth() (*DeviceAuthResponse, error) {
	body := url.Values{
		"client_id": {c.clientID},
		"scope":     {"vivid"},
	}
	into := DeviceAuthResponse{}
	err := c.client.PostForm("/oauth/device/authorize", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c CloudAuthClient) ExchangeToken(request TokenRequest) (*TokenResponse, error) {
	body := url.Values{
		"grant_type": {request.GrantType},
		"client_id":  {c.clientID},
		"scope":      {"vivid"},
	}
	if request.DeviceCode != "" {
		body.Set("device_code", request.DeviceCode)
	}
	if request.RefreshToken != "" {
		body.Set("refresh_token", request.RefreshToken)
	}

	into := TokenResponse{}
	err := c.client.PostForm("/oauth/token", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
