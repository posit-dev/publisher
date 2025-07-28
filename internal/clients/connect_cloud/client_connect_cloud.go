package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
)

type ConnectCloudClient struct {
	log    logging.Logger
	client http_client.HTTPClient
}

func NewConnectCloudClientWithAuth(
	baseURL string,
	log logging.Logger,
	timeout time.Duration,
	authValue string) APIClient {
	httpClient := http_client.NewBasicHTTPClientWithAuth(baseURL, timeout, authValue)
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

func (c ConnectCloudClient) CreateContent(request *types.CreateContentRequest) (*types.ContentResponse, error) {
	into := types.ContentResponse{}
	err := c.client.Post("/v1/contents", request, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) UpdateContent(request *types.UpdateContentRequest) (*types.ContentResponse, error) {
	into := types.ContentResponse{}
	url := fmt.Sprintf("/v1/contents/%s?new_bundle=true", request.ContentID)
	err := c.client.Patch(url, &request.ContentRequestBase, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) GetRevision(revisionID string) (*types.Revision, error) {
	into := types.Revision{}
	url := fmt.Sprintf("/v1/revisions/%s", revisionID)
	err := c.client.Get(url, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}

func (c ConnectCloudClient) GetAuthorization(request *types.AuthorizationRequest) (*types.AuthorizationResponse, error) {
	into := types.AuthorizationResponse{}
	err := c.client.Post("/v1/authorization", request, &into, c.log)
	if err != nil {
		return nil, err
	}
	return &into, nil
}
