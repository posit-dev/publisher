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
	account     *accounts.Account
	log         logging.Logger
	client      http_client.HTTPClient
	credService credentials.CredentialsService
	timeout     time.Duration
}

var _ APIClient = &ConnectCloudClient{}

func NewConnectCloudClientWithAuth(
	environment types.CloudEnvironment,
	log logging.Logger,
	timeout time.Duration,
	account *accounts.Account,
	authorizationHeader string) (APIClient, error) {
	if account != nil {
		authorizationHeader = fmt.Sprintf("Bearer %s", account.CloudAccessToken)
	}
	httpClient := http_client.NewBasicHTTPClientWithBearerAuth(getBaseURL(environment), timeout, authorizationHeader)
	credService, err := credentials.NewCredentialsService(log)
	if err != nil {
		return nil, err
	}
	return &ConnectCloudClient{
		account:     account,
		log:         log,
		client:      httpClient,
		credService: credService,
		timeout:     timeout,
	}, nil
}

var cloudAuthClientFactory = cloud_auth.NewCloudAuthClient
var credServiceFactory = credentials.NewCredentialsService
var httpClientFactory = http_client.NewBasicHTTPClientWithBearerAuth

func retryAuthErr[V any](c *ConnectCloudClient, makeRequest func() (V, error)) (V, error) {
	f, err := makeRequest()
	if err != nil {
		_, ok := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized)
		if ok {
			// If this is a 401 due to an expired token, we should refresh the token and retry the request.
			c.log.Debug("received 401 Unauthorized response, attempting to refresh token and retry request")
			authClient := cloudAuthClientFactory(c.account.CloudEnvironment, c.log, 10*time.Second)
			tokenRequest := cloud_auth.TokenRequest{
				GrantType:    "refresh_token",
				RefreshToken: c.account.CloudRefreshToken,
			}
			resp, err := authClient.ExchangeToken(tokenRequest)
			if err != nil {
				var zero V
				return zero, fmt.Errorf("error refreshing token: %w", err)
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
				var zero V
				return zero, fmt.Errorf("error updating credential with new token: %w", err)
			}
			c.account.CloudAccessToken = resp.AccessToken
			c.account.CloudRefreshToken = resp.RefreshToken

			// Set the client to one with the new token.
			c.client = httpClientFactory(getBaseURL(c.account.CloudEnvironment), c.timeout, fmt.Sprintf("Bearer %s", resp.AccessToken))

			f, err = makeRequest()
			if err != nil {
				var zero V
				return zero, err
			}
			return f, nil
		}
		var zero V
		return zero, err
	}
	return f, nil
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

func (c *ConnectCloudClient) CreateContent(request *clienttypes.CreateContentRequest) (*clienttypes.ContentResponse, error) {
	doIt := func() (*clienttypes.ContentResponse, error) {
		into := clienttypes.ContentResponse{}
		err := c.client.Post("/v1/contents", request, &into, c.log)
		if err != nil {
			return nil, fmt.Errorf("error in create content response: %w", err)
		}
		return &into, nil
	}
	r, err := retryAuthErr(c, doIt)
	return r, err
}

func (c *ConnectCloudClient) UpdateContent(request *clienttypes.UpdateContentRequest) (*clienttypes.ContentResponse, error) {
	doIt := func() (*clienttypes.ContentResponse, error) {
		into := clienttypes.ContentResponse{}
		url := fmt.Sprintf("/v1/contents/%s", request.ContentID)
		err := c.client.Patch(url, &request.ContentRequestBase, &into, c.log)
		if err != nil {
			return nil, fmt.Errorf("error in update content response: %w", err)
		}
		return &into, nil
	}
	return retryAuthErr(c, doIt)
}

func (c *ConnectCloudClient) UpdateContentBundle(contentID types.ContentID) (*clienttypes.ContentResponse, error) {
	doIt := func() (*clienttypes.ContentResponse, error) {
		into := clienttypes.ContentResponse{}
		url := fmt.Sprintf("/v1/contents/%s?new_bundle=true", contentID)
		err := c.client.Patch(url, nil, &into, c.log)
		if err != nil {
			return nil, fmt.Errorf("error in update content bundle response: %w", err)
		}
		return &into, nil
	}
	return retryAuthErr(c, doIt)
}

func (c *ConnectCloudClient) GetRevision(revisionID string) (*clienttypes.Revision, error) {
	doIt := func() (*clienttypes.Revision, error) {
		into := clienttypes.Revision{}
		url := fmt.Sprintf("/v1/revisions/%s", revisionID)
		err := c.client.Get(url, &into, c.log)
		if err != nil {
			return nil, fmt.Errorf("error in get revision response: %w", err)
		}
		return &into, nil
	}
	return retryAuthErr(c, doIt)
}

func (c *ConnectCloudClient) GetAuthorization(request *clienttypes.AuthorizationRequest) (*clienttypes.AuthorizationResponse, error) {
	doIt := func() (*clienttypes.AuthorizationResponse, error) {
		into := clienttypes.AuthorizationResponse{}
		err := c.client.Post("/v1/authorization", request, &into, c.log)
		if err != nil {
			return nil, fmt.Errorf("error in get authorization response: %w", err)
		}
		return &into, nil
	}
	return retryAuthErr(c, doIt)
}

func (c *ConnectCloudClient) PublishContent(contentID string) error {
	doIt := func() (bool, error) {
		url := fmt.Sprintf("/v1/contents/%s/publish", contentID)
		err := c.client.Post(url, nil, nil, c.log)
		if err != nil {
			return false, fmt.Errorf("error in publish content response: %w", err)
		}
		return true, nil
	}
	_, err := retryAuthErr(c, doIt)
	return err
}
