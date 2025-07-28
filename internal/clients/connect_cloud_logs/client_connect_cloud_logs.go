package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
)

// ConnectCloudLogsClient is a client for the Connect Cloud Logs API.
type ConnectCloudLogsClient struct {
	log    logging.Logger
	client http_client.HTTPClient
}

// NewConnectCloudLogsClientWithAuth creates a new ConnectCloudLogsClient with authentication.
func NewConnectCloudLogsClientWithAuth(
	baseURL string,
	log logging.Logger,
	timeout time.Duration,
	authValue string) LogsAPIClient {
	httpClient := http_client.NewBasicHTTPClientWithAuth(baseURL, timeout, authValue)
	return &ConnectCloudLogsClient{
		log:    log,
		client: httpClient,
	}
}

// GetLogs retrieves logs for a specific log channel.
func (c ConnectCloudLogsClient) GetLogs(logChannel string) (*LogsResponse, error) {
	into := LogsResponse{}
	url := fmt.Sprintf("/v1/logs/%s", logChannel)
	err := c.client.Get(url, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}