package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
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
	expectedResult := &UserResponse{
		AccountRoles: map[string]UserAccountRole{
			"account1": {
				Role: "admin",
				Account: UserAccountRoleAccount{
					Name: "Account 1",
				},
			},
			"account2": {
				Role: "admin",
				Account: UserAccountRoleAccount{
					Name: "Account 2",
				},
			},
		},
	}

	httpClient.On("Get", "/v1/users/me", mock.Anything, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(1).(*UserResponse)
		result.AccountRoles = expectedResult.AccountRoles
	}
	client := &ConnectCloudClient{
		client: httpClient,
		log:    logging.New(),
	}
	result, err := client.GetCurrentUser()
	s.NoError(err)
	s.Equal(expectedResult, result)
}

func (s *ConnectCloudClientSuite) TestCreateContent() {
	httpClient := &http_client.MockHTTPClient{}

	request := &CreateContentRequest{
		ContentRequestBase: ContentRequestBase{
			Title:       "my cool content",
			Description: "Don't you just love my piece of content?",
			NextRevision: NextRevision{
				SourceType:    "bundle",
				RVersion:      "4.0.0",
				PythonVersion: "3.11.0",
			},
			Access: ViewPrivateEditPrivate,
			Secrets: []Secret{
				{
					Name:  "SUPER_SECRET",
					Value: "go away",
				},
			},
			VanityName:  "my-cool-content",
			AppMode:     clienttypes.PythonBokehMode,
			ContentType: ContentTypeBokeh,
		},
		AccountID: "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
	}

	expectedResponse := &ContentResponse{
		ID:                    "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
		SourceBundleID:        "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
		SourceBundleUploadURL: "https://bundle.upload.url",
		NextRevision: &Revision{
			ID:                "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65",
			PublishLogChannel: "publish-log-channel-1",
			PublishResult:     PublishResultSuccess,
		},
	}

	httpClient.On("Post", "/v1/contents", request, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*ContentResponse)
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

	contentID := "449e7a5c-69d3-4b8a-aaaf-5c9b713ebc65"
	request := &UpdateContentRequest{
		ContentRequestBase: ContentRequestBase{
			Title:       "my updated content",
			Description: "This content was updated",
			NextRevision: NextRevision{
				SourceType:    "bundle",
				RVersion:      "4.2.0",
				PythonVersion: "3.12.0",
			},
			Access: ViewTeamEditPrivate,
			Secrets: []Secret{
				{
					Name:  "UPDATED_SECRET",
					Value: "new value",
				},
			},
			VanityName:  "my-updated-content",
			AppMode:     clienttypes.PythonBokehMode,
			ContentType: ContentTypeBokeh,
		},
		ContentID: contentID,
	}

	expectedResponse := &ContentResponse{
		ID:                    contentID,
		SourceBundleID:        "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
		SourceBundleUploadURL: "https://new-bundle.upload.url",
		NextRevision: &Revision{
			ID:                "559e7a5c-69d3-4b8a-bbaf-5c9b713ebc76",
			PublishLogChannel: "publish-log-channel-2",
			PublishResult:     PublishResultSuccess,
		},
	}

	httpClient.On("Patch", "/v1/contents/"+contentID+"?new_bundle=true", &request.ContentRequestBase, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*ContentResponse)
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

	expectedRevision := &Revision{
		ID:                revisionID,
		PublishLogChannel: "publish-log-channel-2",
		PublishResult:     PublishResultSuccess,
		PublishErrorCode:  "",
		PublishErrorArgs:  nil,
	}

	httpClient.On("Get", "/v1/revisions/"+revisionID, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(1).(*Revision)
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
	request := &AuthorizationRequest{
		ResourceType: "log_channel",
		ResourceID:   logChannelID,
		Permission:   "revision.logs.read",
	}

	expectedResponse := &AuthorizationResponse{
		Authorized: true,
		Token:      "authorization-token-123",
	}

	httpClient.On("Post", "/v1/authorization", request, mock.Anything, mock.Anything).
		Return(nil).RunFn = func(args mock.Arguments) {
		result := args.Get(2).(*AuthorizationResponse)
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
