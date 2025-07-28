package cloud_auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
)

type CloudAuthClient struct {
	log     logging.Logger
	client  http_client.HTTPClient
	baseURL string
}

func NewCloudAuthClient(
	baseURL string,
	log logging.Logger,
	timeout time.Duration) APIClient {
	httpClient := http_client.NewBasicHTTPClient(baseURL, timeout)

	return &CloudAuthClient{
		log:     log,
		client:  httpClient,
		baseURL: baseURL,
	}
}

func (c CloudAuthClient) getClientID() (string, error) {
	switch c.baseURL {
	case "https://login.staging.posit.cloud":
		return "posit-publisher-staging", nil
	case "https://login.posit.cloud":
		return "posit-publisher", nil
	default:
		return "", fmt.Errorf("unable to determine client ID for unknown base URL: %s", c.baseURL)
	}
}

func (c CloudAuthClient) CreateDeviceAuth() (*DeviceAuthResponse, error) {
	clientId, err := c.getClientID()
	if err != nil {
		return nil, err
	}
	body := url.Values{
		"client_id": {clientId},
		"scope":     {"vivid"},
	}
	into := DeviceAuthResponse{}
	err = c.client.PostForm("/oauth/device/authorize", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c CloudAuthClient) ExchangeToken(request TokenRequest) (*TokenResponse, error) {
	clientId, err := c.getClientID()
	if err != nil {
		return nil, err
	}
	body := url.Values{
		"grant_type":  {request.GrantType},
		"device_code": {request.DeviceCode},
		"client_id":   {clientId},
	}
	into := TokenResponse{}
	err = c.client.PostForm("/oauth/token", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
