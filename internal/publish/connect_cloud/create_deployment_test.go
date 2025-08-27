package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// CreateDeploymentSuite is a test suite for testing create_deployment.go
type CreateDeploymentSuite struct {
	utiltest.Suite
	mockClient *connect_cloud.MockClient
	emitter    *events.CapturingEmitter
	publisher  *ServerPublisher

	// Test constants
	contentID     types.ContentID
	saveName      string
	accountID     string
	title         string
	description   string
	entrypoint    string
	rVersion      string
	pythonVersion string
}

func TestCreateDeploymentSuite(t *testing.T) {
	suite.Run(t, new(CreateDeploymentSuite))
}

func (s *CreateDeploymentSuite) SetupTest() {
	// Set up test constants
	s.contentID = types.ContentID("test-content-id")
	s.saveName = "test-save-name"
	s.accountID = "test-account-id"
	s.title = "Test Content Title"
	s.description = "Test content description"
	s.entrypoint = "app.py"
	s.rVersion = "4.2.0"
	s.pythonVersion = "3.10"

	// Create a mock client
	s.mockClient = connect_cloud.NewMockClient()

	// Setup GetAccount for private content entitlement check
	mockAccount := &connect_cloud.Account{
		ID:          s.accountID,
		Name:        "test-account",
		DisplayName: "Test Account",
		License: &connect_cloud.AccountLicense{
			Entitlements: connect_cloud.AccountEntitlements{
				AccountPrivateContentFlag: connect_cloud.AccountEntitlement{
					Enabled: false, // Default to no private content entitlement
				},
			},
		},
	}
	s.mockClient.On("GetAccount", s.accountID).Return(mockAccount, nil)

	// Set up capturing emitter to verify events
	s.emitter = events.NewCapturingEmitter()

	// Create config with required fields
	cfg := config.New()
	cfg.Title = s.title
	cfg.Description = s.description
	cfg.Type = contenttypes.ContentTypePythonDash
	cfg.Entrypoint = s.entrypoint
	cfg.R = &config.R{Version: s.rVersion}
	cfg.Python = &config.Python{Version: s.pythonVersion}

	// Create a state with required fields
	stateObj := &state.State{
		Target:   &deployment.Deployment{},
		SaveName: s.saveName,
		Config:   cfg,
		Account:  &accounts.Account{CloudAccountID: s.accountID},
	}

	// Create a publisher helper
	helper := publishhelper.NewPublishHelper(stateObj, logging.New())

	// Create a publisher
	s.publisher = &ServerPublisher{
		State:   stateObj,
		log:     logging.New(),
		emitter: s.emitter,
		helper:  helper,
		client:  s.mockClient,
	}
}

func (s *CreateDeploymentSuite) TestCreateDeployment() {
	// Set up expected content response
	expectedResponse := &clienttypes.ContentResponse{
		ID: s.contentID,
		NextRevision: &clienttypes.Revision{
			ID: "test-revision-id",
		},
	}

	// Setup mock to return the expected response
	s.mockClient.On("CreateContent", mock.MatchedBy(func(request *clienttypes.CreateContentRequest) bool {
		// Verify that the request contains expected values
		return request.AccountID == s.accountID &&
			request.Title == s.title &&
			request.Description == s.description &&
			request.NextRevision.PrimaryFile == s.entrypoint &&
			request.NextRevision.RVersion == s.rVersion &&
			request.NextRevision.PythonVersion == s.pythonVersion
	})).Return(expectedResponse, nil)

	// Call CreateDeployment
	contentID, err := s.publisher.CreateDeployment()

	// Verify no error is returned
	s.NoError(err)

	// Verify the returned content ID matches expected
	s.Equal(s.contentID, contentID)

	// Verify content is stored on the publisher
	s.Equal(expectedResponse, s.publisher.content)

	// Verify mock was called with the expected request
	s.mockClient.AssertCalled(s.T(), "CreateContent", mock.Anything)

	// Verify emitter received the expected events
	s.Len(s.emitter.Events, 2, "Should have emitted 2 events (start and success)")

	// Check start event
	s.Equal("publish/createNewDeployment/start", s.emitter.Events[0].Type)
	s.Equal(events.EventData{"saveName": s.saveName}, s.emitter.Events[0].Data)

	// Check success event
	s.Equal("publish/createNewDeployment/success", s.emitter.Events[1].Type)
	s.Equal(events.EventData{
		"contentId": s.contentID,
		"saveName":  s.saveName,
	}, s.emitter.Events[1].Data)
}

func (s *CreateDeploymentSuite) TestCreateDeploymentError() {
	// Create a mock error
	mockError := types.NewAgentError(types.ErrorUnknown, errors.New("create content failed"), nil)

	// Setup mock to return the error
	s.mockClient.On("CreateContent", mock.Anything).Return((*clienttypes.ContentResponse)(nil), mockError)

	// Call CreateDeployment
	_, err := s.publisher.CreateDeployment()

	// Verify an error is returned
	s.Error(err)

	// Verify it's the expected operation error
	s.Contains(err.Error(), "create content failed")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(events.PublishCreateNewDeploymentOp, eventableErr.GetOperation())

	// Verify mock was called with the expected request
	s.mockClient.AssertCalled(s.T(), "CreateContent", mock.Anything)

	// Verify emitter only received the start event (no success event)
	s.Len(s.emitter.Events, 1, "Should have emitted only 1 event (start)")

	// Check start event
	s.Equal("publish/createNewDeployment/start", s.emitter.Events[0].Type)
	s.Equal(events.EventData{"saveName": s.saveName}, s.emitter.Events[0].Data)
}
