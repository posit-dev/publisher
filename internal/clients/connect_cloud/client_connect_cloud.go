package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
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

func (c ConnectCloudClient) GetAccounts() (*AccountListResponse, error) {
	into := AccountListResponse{}
	err := c.client.Get("/v1/accounts?has_user_role=true", &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) CreateContent(request *clienttypes.CreateContentRequest) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	err := c.client.Post("/v1/contents", request, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) UpdateContent(request *clienttypes.UpdateContentRequest) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	url := fmt.Sprintf("/v1/contents/%s?new_bundle=true", request.ContentID)
	err := c.client.Patch(url, &request.ContentRequestBase, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) GetRevision(revisionID string) (*clienttypes.Revision, error) {
	into := clienttypes.Revision{}
	url := fmt.Sprintf("/v1/revisions/%s", revisionID)
	err := c.client.Get(url, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) GetAuthorization(request *clienttypes.AuthorizationRequest) (*clienttypes.AuthorizationResponse, error) {
	into := clienttypes.AuthorizationResponse{}
	err := c.client.Post("/v1/authorization", request, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) PublishContent(contentID string) error {
	url := fmt.Sprintf("/v1/content/%s/publish", contentID)
	err := c.client.Post(url, nil, nil, c.log)
	if err != nil {
		return err
	}
	return nil
}
