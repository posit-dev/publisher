package cloud_auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"net/url"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
)

type CloudAuthClient struct {
	log    logging.Logger
	client http_client.HTTPClient
}

func NewCloudAuthClient(
	baseURL string,
	log logging.Logger,
	timeout time.Duration) APIClient {
	httpClient := http_client.NewBasicHTTPClient(baseURL, timeout)

	return &CloudAuthClient{
		log:    log,
		client: httpClient,
	}
}

func (c CloudAuthClient) CreateDeviceAuth(request DeviceAuthRequest) (*DeviceAuthResponse, error) {
	body := url.Values{
		"client_id": {request.ClientID},
		"scope":     {request.Scope},
	}
	into := DeviceAuthResponse{}
	err := c.client.PostForm("/device_authorization", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c CloudAuthClient) ExchangeToken(request TokenRequest) (*TokenResponse, error) {
	body := url.Values{
		"grant_type":  {request.GrantType},
		"device_code": {request.DeviceCode},
		"client_id":   {request.ClientID},
	}
	into := TokenResponse{}
	err := c.client.PostForm("/oauth/token", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
