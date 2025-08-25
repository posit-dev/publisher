package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

const baseURLDevelopment = "https://api.dev.connect.posit.cloud"
const baseURLStaging = "https://api.staging.connect.posit.cloud"
const baseURLProduction = "https://api.connect.posit.cloud"

func getBaseURL(environment types.CloudEnvironment) string {
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
	account                *accounts.Account
	log                    logging.Logger
	client                 http_client.HTTPClient
	credService            credentials.CredentialsService
	timeout                time.Duration
	cloudAuthClientFactory cloud_auth.CloudAuthClientFactory
	httpClientFactory      http_client.HTTPClientWithBearerAuthFactory
}

var _ APIClient = &ConnectCloudClient{}

func NewConnectCloudClientWithAuth(
	environment types.CloudEnvironment,
	log logging.Logger,
	timeout time.Duration,
	account *accounts.Account,
	authToken types.CloudAuthToken,
) (APIClient, error) {
	if account != nil {
		authToken = account.CloudAccessToken
	}
	httpClient := http_client.NewBasicHTTPClientWithBearerAuth(getBaseURL(environment), timeout, string(authToken))
	credService, err := credentials.NewCredentialsService(log)
	if err != nil {
		return nil, err
	}
	return &ConnectCloudClient{
		account:                account,
		log:                    log,
		client:                 httpClient,
		credService:            credService,
		timeout:                timeout,
		cloudAuthClientFactory: cloud_auth.NewCloudAuthClient,
		httpClientFactory:      http_client.NewBasicHTTPClientWithBearerAuth,
	}, nil
}

// refreshCred exchanges the refresh token for a new access token, then updates the stored credential and the HTTP client.
func (c *ConnectCloudClient) refreshCred() error {
	// If this is a 401 due to an expired token, we should refresh the token and retry the request.
	c.log.Debug("received 401 Unauthorized response, attempting to refresh token and retry request")
	authClient := c.cloudAuthClientFactory(c.account.CloudEnvironment, c.log, c.timeout)
	tokenRequest := cloud_auth.TokenRequest{
		GrantType:    "refresh_token",
		RefreshToken: c.account.CloudRefreshToken,
	}
	resp, err := authClient.ExchangeToken(tokenRequest)
	if err != nil {
		return fmt.Errorf("error refreshing token: %w", err)
	}
	_, err = c.credService.ForceSet(credentials.CreateCredentialDetails{
		Name:             c.account.Name,
		URL:              c.account.URL,
		ServerType:       c.account.ServerType,
		AccountID:        c.account.CloudAccountID,
		AccountName:      c.account.CloudAccountName,
		CloudEnvironment: c.account.CloudEnvironment,
		RefreshToken:     resp.RefreshToken,
		AccessToken:      resp.AccessToken,
	})
	if err != nil {
		return fmt.Errorf("error updating credential with new token: %w", err)
	}
	c.account.CloudAccessToken = resp.AccessToken
	c.account.CloudRefreshToken = resp.RefreshToken

	// Set the client to one with the new token.
	c.client = c.httpClientFactory(getBaseURL(c.account.CloudEnvironment), c.timeout, string(resp.AccessToken))
	return nil
}

// handleAuthErr refreshes the credential and returns true if the passed error is due to authorization.
func (c *ConnectCloudClient) handleAuthErr(err error) (bool, error) {
	if err == nil {
		return false, nil
	}
	_, isUnauthorized := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized)
	if isUnauthorized {
		refreshErr := c.refreshCred()
		if refreshErr != nil {
			return false, refreshErr
		}
		return true, nil
	}
	return false, err
}

func (c *ConnectCloudClient) GetCurrentUser() (*UserResponse, error) {
	into := UserResponse{}
	err := c.client.Get("/v1/users/me", &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get current user response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) GetAccounts() (*AccountListResponse, error) {
	into := AccountListResponse{}
	err := c.client.Get("/v1/accounts?has_user_role=true", &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get accounts response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) getAccount(accountID string) (*Account, error) {
	into := Account{}
	url := fmt.Sprintf("/v1/accounts/%s", accountID)
	err := c.client.Get(url, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get account response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) GetAccount(accountID string) (*Account, error) {
	r, err := c.getAccount(accountID)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.getAccount(accountID)
	}
	return r, err
}

func (c *ConnectCloudClient) getContent(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	err := c.client.Get(fmt.Sprintf("/v1/contents/%s", contentID), &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get content response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) GetContent(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	r, err := c.getContent(contentID)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.getContent(contentID)
	}
	return r, err
}

func (c *ConnectCloudClient) createContent(request *clienttypes.CreateContentRequest) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	err := c.client.Post("/v1/contents", request, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in create content response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) CreateContent(request *clienttypes.CreateContentRequest) (*clienttypes.ContentResponse, error) {
	r, err := c.createContent(request)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.createContent(request)
	}
	return r, err
}

func (c *ConnectCloudClient) updateContent(request *clienttypes.UpdateContentRequest) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	url := fmt.Sprintf("/v1/contents/%s", request.ContentID)
	err := c.client.Patch(url, &request.ContentRequestBase, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in update content response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) UpdateContent(request *clienttypes.UpdateContentRequest) (*clienttypes.ContentResponse, error) {
	r, err := c.updateContent(request)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.updateContent(request)
	}
	return r, err
}

func (c *ConnectCloudClient) updateContentBundle(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	into := clienttypes.ContentResponse{}
	url := fmt.Sprintf("/v1/contents/%s?new_bundle=true", contentID)
	err := c.client.Patch(url, nil, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in update content bundle response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) UpdateContentBundle(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	r, err := c.updateContentBundle(contentID)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.updateContentBundle(contentID)
	}
	return r, err
}

func (c *ConnectCloudClient) getRevision(revisionID string) (*clienttypes.Revision, error) {
	into := clienttypes.Revision{}
	url := fmt.Sprintf("/v1/revisions/%s", revisionID)
	err := c.client.Get(url, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get revision response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) GetRevision(revisionID string) (*clienttypes.Revision, error) {
	r, err := c.getRevision(revisionID)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.getRevision(revisionID)
	}
	return r, err
}

func (c *ConnectCloudClient) getAuthorization(request *clienttypes.AuthorizationRequest) (*clienttypes.AuthorizationResponse, error) {
	into := clienttypes.AuthorizationResponse{}
	err := c.client.Post("/v1/authorization", request, &into, c.log)
	if err != nil {
		return nil, fmt.Errorf("error in get authorization response: %w", err)
	}
	return &into, nil
}

func (c *ConnectCloudClient) GetAuthorization(request *clienttypes.AuthorizationRequest) (*clienttypes.AuthorizationResponse, error) {
	r, err := c.getAuthorization(request)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return nil, handlingErr
	}
	if shouldRetry {
		r, err = c.getAuthorization(request)
	}
	return r, err
}

func (c *ConnectCloudClient) publishContent(contentID string) error {
	url := fmt.Sprintf("/v1/contents/%s/publish", contentID)
	err := c.client.Post(url, nil, nil, c.log)
	if err != nil {
		return fmt.Errorf("error in publish content response: %w", err)
	}
	return nil
}

func (c *ConnectCloudClient) PublishContent(contentID string) error {
	err := c.publishContent(contentID)
	shouldRetry, handlingErr := c.handleAuthErr(err)
	if handlingErr != nil {
		return handlingErr
	}
	if shouldRetry {
		err = c.publishContent(contentID)
	}
	return err
}
