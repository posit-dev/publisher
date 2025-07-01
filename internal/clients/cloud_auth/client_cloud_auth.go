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

func (c CloudAuthClient) CreateDeviceAuth(request DeviceAuthRequest) (*DeviceAuthResult, error) {
	body := url.Values{
		"client_id": {request.ClientID},
		"scope":     {request.Scope},
	}
	into := DeviceAuthResult{}
	err := c.client.PostForm("/device_authorization", body, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
