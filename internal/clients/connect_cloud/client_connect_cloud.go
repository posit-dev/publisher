package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"time"

	"github.com/posit-dev/publisher/internal/types"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
)

const baseURLDevelopment = "https://api.dev.connect.posit.cloud"
const baseURLStaging = "https://api.staging.connect.posit.cloud"
const baseURLProduction = "https://api.connect.posit.cloud"

func GetBaseURL(environment types.CloudEnvironment) string {
	switch environment {
	case types.CloudEnvironmentDevelopment:
		return baseURLDevelopment
	case types.CloudEnvironmentStaging:
		return baseURLStaging
	default:
		return baseURLProduction
	}
}

type ConnectCloudClient struct {
	log    logging.Logger
	client http_client.HTTPClient
}

var _ APIClient = &ConnectCloudClient{}

func NewConnectCloudClientWithAuth(
	environment types.CloudEnvironment,
	log logging.Logger,
	timeout time.Duration,
	authValue string) APIClient {
	httpClient := http_client.NewBasicHTTPClientWithAuth(GetBaseURL(environment), timeout, authValue)
	return &ConnectCloudClient{
		log:    log,
		client: httpClient,
	}
}

func (c ConnectCloudClient) GetCurrentUser() (*UserResponse, error) {
	into := UserResponse{}
	err := c.client.Get("/v1/users/me", &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) CreateUser() error {
	err := c.client.Post("/v1/users", nil, nil, c.log)
	if err != nil {
		return err
	}
	return nil
}

func (c ConnectCloudClient) GetAccounts() (*AccountListResponse, error) {
	into := AccountListResponse{}
	err := c.client.Get("/v1/accounts?has_user_role=true", &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
