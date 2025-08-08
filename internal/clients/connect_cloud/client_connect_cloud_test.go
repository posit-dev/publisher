package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
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

	apiClient := NewConnectCloudClientWithAuth("https://api.staging.login.posit.cloud", log, timeout, "Bearer the_token")
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
