package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type ConnectCloudClientSuite struct {
	utiltest.Suite
}

func TestConnectCloudClientSuite(t *testing.T) {
	s := new(ConnectCloudClientSuite)
	suite.Run(t, s)
}

func (s *ConnectCloudClientSuite) TestNewConnectCloudClient() {
	timeout := 10 * time.Second
	log := logging.New()

	apiClient, err := NewConnectCloudClientWithAuth(types.CloudEnvironmentStaging, log, timeout, nil, "Bearer the_token")
	s.NoError(err)
	client := apiClient.(*ConnectCloudClient)
	s.NotNil(client.client)
}

func (s *ConnectCloudClientSuite) TestGetCurrentUser() {
	httpClient := &http_client.MockHTTPClient{}

	httpClient.On("Get", "/v1/users/me", mock.Anything, mock.Anything, mock.Anything).
		Return(nil)
	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}
	_, err := client.GetCurrentUser()
	s.NoError(err)
}

func (s *ConnectCloudClientSuite) TestCreateContent() {
	httpClient := &http_client.MockHTTPClient{}

	request := &clienttypes.CreateContentRequest{
		ContentRequestBase: clienttypes.ContentRequestBase{
			Title:       "my cool content",
			Description: "Don't you just love my piece of content?",
			NextRevision: clienttypes.NextRevision{
				SourceType:    "bundle",
				RVersion:      "4.0.0",
				PythonVersion: "3.11.0",
			},
			Access: clienttypes.ViewPrivateEditPrivate,
			Secrets: []clienttypes.Secret{
				{
					Name:  "SUPER_SECRET",
					Value: "go away",
				},
			},
			VanityName:  "my-cool-content",
			AppMode:     clienttypes.PythonBokehMode,
			ContentType: clienttypes.ContentTypeBokeh,
		},
		AccountID: "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
	}

	expectedResponse := &clienttypes.ContentResponse{
		ID: "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
		NextRevision: &clienttypes.Revision{
			ID:                    "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
			PublishLogChannel:     "publish-log-channel-1",
			PublishResult:         clienttypes.PublishResultSuccess,
			SourceBundleID:        "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
			SourceBundleUploadURL: "https://bundle.upload.url",
		},
	}

	httpClient.On("Post", "/v1/contents", request, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*clienttypes.ContentResponse)
		*result = *expectedResponse
	}

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	response, err := client.CreateContent(request)
	s.NoError(err)
	s.Equal(expectedResponse, response)
}

func (s *ConnectCloudClientSuite) TestUpdateContent() {
	httpClient := &http_client.MockHTTPClient{}

	contentID := types.ContentID("449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65")
	request := &clienttypes.UpdateContentRequest{
		ContentRequestBase: clienttypes.ContentRequestBase{
			Title:       "my updated content",
			Description: "This content was updated",
			NextRevision: clienttypes.NextRevision{
				SourceType:    "bundle",
				RVersion:      "4.2.0",
				PythonVersion: "3.12.0",
			},
			Access: clienttypes.ViewTeamEditPrivate,
			Secrets: []clienttypes.Secret{
				{
					Name:  "UPDATED_SECRET",
					Value: "new value",
				},
			},
			VanityName:  "my-updated-content",
			AppMode:     clienttypes.PythonBokehMode,
			ContentType: clienttypes.ContentTypeBokeh,
		},
		ContentID: contentID,
	}

	expectedResponse := &clienttypes.ContentResponse{
		ID: contentID,
		NextRevision: &clienttypes.Revision{
			ID:                    "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
			PublishLogChannel:     "publish-log-channel-2",
			PublishResult:         clienttypes.PublishResultSuccess,
			SourceBundleID:        "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
			SourceBundleUploadURL: "https://new-bundle.upload.url",
		},
	}

	httpClient.On("Patch", fmt.Sprintf("/v1/contents/%s", contentID), &request.ContentRequestBase, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*clienttypes.ContentResponse)
		*result = *expectedResponse
	}

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	response, err := client.UpdateContent(request)
	s.NoError(err)
	s.Equal(expectedResponse, response)
}

func (s *ConnectCloudClientSuite) TestGetRevision() {
	httpClient := &http_client.MockHTTPClient{}

	revisionID := "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76"

	expectedRevision := &clienttypes.Revision{
		ID:                revisionID,
		PublishLogChannel: "publish-log-channel-2",
		PublishResult:     clienttypes.PublishResultSuccess,
		PublishErrorCode:  "",
		PublishErrorArgs:  nil,
	}

	httpClient.On("Get", "/v1/revisions/"+revisionID, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(1).(*clienttypes.Revision)
		*result = *expectedRevision
	}

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	revision, err := client.GetRevision(revisionID)
	s.NoError(err)
	s.Equal(expectedRevision, revision)
	s.Equal("publish-log-channel-2", revision.PublishLogChannel)
	s.Equal("success", string(revision.PublishResult))
}

func (s *ConnectCloudClientSuite) TestGetAuthorization() {
	httpClient := &http_client.MockHTTPClient{}

	logChannelID := "publish-log-channel-123"
	request := &clienttypes.AuthorizationRequest{
		ResourceType: "log_channel",
		ResourceID:   logChannelID,
		Permission:   "revision.logs.read",
	}

	expectedResponse := &clienttypes.AuthorizationResponse{
		Authorized: true,
		Token:      "authorization-token-123",
	}

	httpClient.On("Post", "/v1/authorization", request, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*clienttypes.AuthorizationResponse)
		*result = *expectedResponse
	}

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	response, err := client.GetAuthorization(request)
	s.NoError(err)
	s.Equal(expectedResponse, response)
	s.True(response.Authorized)
	s.Equal("authorization-token-123", response.Token)
}

func (s *ConnectCloudClientSuite) TestPublishContent() {
	httpClient := &http_client.MockHTTPClient{}

	contentID := "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65"
	expectedURL := fmt.Sprintf("/v1/contents/%s/publish", contentID)

	httpClient.On("Post", expectedURL, nil, mock.Anything, mock.Anything).
		Return(nil)

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	err := client.PublishContent(contentID)
	s.NoError(err)
	httpClient.AssertCalled(s.T(), "Post", expectedURL, nil, mock.Anything, mock.Anything)
}

func (s *ConnectCloudClientSuite) TestUpdateContentBundle() {
	httpClient := &http_client.MockHTTPClient{}

	contentID := types.ContentID("449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65")
	expectedURL := fmt.Sprintf("/v1/contents/%s?new_bundle=true", contentID)

	expectedResponse := &clienttypes.ContentResponse{
		ID: contentID,
		NextRevision: &clienttypes.Revision{
			ID:                    "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
			PublishLogChannel:     "publish-log-channel-2",
			PublishResult:         clienttypes.PublishResultSuccess,
			SourceBundleID:        "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
			SourceBundleUploadURL: "https://new-bundle.upload.url",
		},
	}

	httpClient.On("Patch", expectedURL, nil, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*clienttypes.ContentResponse)
		*result = *expectedResponse
	}

	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}

	response, err := client.UpdateContentBundle(contentID)
	s.NoError(err)
	s.Equal(expectedResponse, response)
	httpClient.AssertCalled(s.T(), "Patch", expectedURL, nil, mock.Anything, mock.Anything)
}

func (s *ConnectCloudClientSuite) TestCreateContentWithRetryAuth() {
	// Save the original factory functions so we can restore them after the test
	origCloudAuthClientFactory := cloudAuthClientFactory
	origCredServiceFactory := credServiceFactory
	origHttpClientFactory := httpClientFactory
	defer func() {
		cloudAuthClientFactory = origCloudAuthClientFactory
		credServiceFactory = origCredServiceFactory
		httpClientFactory = origHttpClientFactory
	}()

	// Setup mock HTTP client for initial request that will fail with 401
	firstHttpClient := &http_client.MockHTTPClient{}
	firstHttpError := &http_client.HTTPError{
		Status: http.StatusUnauthorized,
		Body:   "expired token",
	}
	firstAgentError := types.NewAgentError(
		"auth_failed",
		firstHttpError,
		firstHttpError,
	)

	// Setup mock HTTP client for the retry request that will succeed
	secondHttpClient := &http_client.MockHTTPClient{}

	// Setup mock cloud auth client for token refresh
	mockCloudAuthClient := cloud_auth.NewMockClient()

	// Setup mock credentials service
	mockCredService := &credentials.MockCredentialsService{}

	// Test request and expected response
	request := &clienttypes.CreateContentRequest{
		ContentRequestBase: clienttypes.ContentRequestBase{
			Title:       "my refreshed content",
			Description: "This content was created after token refresh",
		},
		AccountID: "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
	}

	expectedResponse := &clienttypes.ContentResponse{
		ID: "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
		NextRevision: &clienttypes.Revision{
			ID:                    "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
			PublishLogChannel:     "publish-log-channel-1",
			PublishResult:         clienttypes.PublishResultSuccess,
			SourceBundleID:        "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
			SourceBundleUploadURL: "https://bundle.upload.url",
		},
	}

	// First request fails with 401
	firstHttpClient.On("Post", "/v1/contents", request, mock.Anything, mock.Anything).Return(firstAgentError)

	// Second request succeeds
	secondHttpClient.On("Post", "/v1/contents", request, mock.Anything, mock.Anything).Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*clienttypes.ContentResponse)
		*result = *expectedResponse
	}

	// Mock token response
	tokenResponse := &cloud_auth.TokenResponse{
		AccessToken:  "NEW_ACCESS_TOKEN",
		RefreshToken: "NEW_REFRESH_TOKEN",
		ExpiresIn:    3600,
		TokenType:    "Bearer",
		Scope:        "vivid",
	}

	// Setup the mock auth client to return the token response
	mockCloudAuthClient.On("ExchangeToken", mock.MatchedBy(func(req cloud_auth.TokenRequest) bool {
		return req.GrantType == "refresh_token" && req.RefreshToken == "OLD_REFRESH_TOKEN"
	})).Return(tokenResponse, nil)

	// Setup the mock credentials service
	mockCredService.On("ForceSet", mock.MatchedBy(func(details credentials.CreateCredentialDetails) bool {
		return details.AccessToken == "NEW_ACCESS_TOKEN" &&
			details.RefreshToken == "NEW_REFRESH_TOKEN" &&
			details.Name == "test-account" &&
			details.AccountName == "Test Account"
	})).Return(&credentials.Credential{}, nil)

	// Replace factory functions with mocks
	cloudAuthClientFactory = func(environment types.CloudEnvironment, log logging.Logger, timeout time.Duration) cloud_auth.APIClient {
		return mockCloudAuthClient
	}

	credServiceFactory = func(log logging.Logger) (credentials.CredentialsService, error) {
		return mockCredService, nil
	}

	//Factory is called to create a new client with the refresh
	httpClientFactory = func(baseURL string, timeout time.Duration, authHeaderValue string) http_client.HTTPClient {
		// Verify that the new token is used for the auth header
		s.Equal("Bearer NEW_ACCESS_TOKEN", authHeaderValue)
		return secondHttpClient
	}

	// Setup test account with old tokens
	account := &accounts.Account{
		Name:              "test-account",
		CloudEnvironment:  types.CloudEnvironmentProduction,
		CloudAccountName:  "Test Account",
		CloudAccessToken:  "OLD_ACCESS_TOKEN",
		CloudRefreshToken: "OLD_REFRESH_TOKEN",
	}

	// Setup the client
	client := &ConnectCloudClient{
		client:      firstHttpClient,
		log:         logging.New(),
		account:     account,
		credService: mockCredService,
		timeout:     10 * time.Second,
	}

	// Test the CreateContent method which should trigger the retry mechanism
	response, err := client.CreateContent(request)

	// Verify results
	s.NoError(err)
	s.Equal(expectedResponse, response)

	// Verify the mocks were called as expected
	firstHttpClient.AssertCalled(s.T(), "Post", "/v1/contents", request, mock.Anything, mock.Anything)
	secondHttpClient.AssertCalled(s.T(), "Post", "/v1/contents", request, mock.Anything, mock.Anything)
	mockCloudAuthClient.AssertExpectations(s.T())
	mockCredService.AssertExpectations(s.T())

	// Verify account was updated with new tokens
	s.Equal("NEW_ACCESS_TOKEN", account.CloudAccessToken)
	s.Equal("NEW_REFRESH_TOKEN", account.CloudRefreshToken)
}
