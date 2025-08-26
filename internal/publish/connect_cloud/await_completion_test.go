package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// AwaitCompletionSuite is a test suite for testing await_completion.go
type AwaitCompletionSuite struct {
	utiltest.Suite
	mockClient *connect_cloud.MockClient
	emitter    *events.CapturingEmitter
	publisher  *ServerPublisher

	// Test constants
	contentID  types.ContentID
	revisionID string
}

func TestAwaitCompletionSuite(t *testing.T) {
	suite.Run(t, new(AwaitCompletionSuite))
}

func (s *AwaitCompletionSuite) SetupSuite() {
	sleep = func(d time.Duration) {}
}

func (s *AwaitCompletionSuite) TearDownSuite() {
	sleep = time.Sleep
}

func (s *AwaitCompletionSuite) SetupTest() {
	sleep = func(d time.Duration) {}

	// Set up test constants
	s.contentID = types.ContentID("test-content-id")
	s.revisionID = "test-revision-id"

	// Create a mock client
	s.mockClient = connect_cloud.NewMockClient()

	// Set up capturing emitter to verify events
	s.emitter = events.NewCapturingEmitter()

	// Create a state with required fields
	stateObj := &state.State{
		Target:  &deployment.Deployment{},
		Account: &accounts.Account{},
	}

	// Create a publisher helper
	helper := publishhelper.NewPublishHelper(stateObj, logging.New())

	// Create a publisher with content response containing revision ID
	s.publisher = &ServerPublisher{
		State:   stateObj,
		log:     logging.New(),
		emitter: s.emitter,
		helper:  helper,
		client:  s.mockClient,
		content: &clienttypes.ContentResponse{
			ID: s.contentID,
			NextRevision: &clienttypes.Revision{
				ID: s.revisionID,
			},
		},
	}
}

func (s *AwaitCompletionSuite) TestAwaitCompletionSuccess() {

	// Setup mock to return success after one call
	revisionInProgress := &clienttypes.Revision{
		ID:            s.revisionID,
		PublishResult: "", // In progress
	}

	revisionSuccess := &clienttypes.Revision{
		ID:            s.revisionID,
		PublishResult: clienttypes.PublishResultSuccess,
	}

	// First call returns in-progress, second call returns success
	s.mockClient.On("GetRevision", s.revisionID).Return(revisionInProgress, nil).Once()
	s.mockClient.On("GetRevision", s.revisionID).Return(revisionSuccess, nil).Once()

	op := events.PublishDeployContentOp

	// Call awaitCompletion
	err := s.publisher.awaitCompletion(logging.New(), op)

	// Verify no error is returned
	s.NoError(err)

	// Verify mock was called twice
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 2)
}

func (s *AwaitCompletionSuite) TestAwaitCompletionFailure() {
	// Setup mock to return failure
	revisionFailure := &clienttypes.Revision{
		ID:                  s.revisionID,
		PublishResult:       clienttypes.PublishResultFailure,
		PublishErrorCode:    "RUNTIME_ERROR",
		PublishError:        "Runtime error",
		PublishErrorDetails: "Unable to start the app",
	}

	s.mockClient.On("GetRevision", s.revisionID).Return(revisionFailure, nil)

	op := events.PublishDeployContentOp

	// Call awaitCompletion
	err := s.publisher.awaitCompletion(logging.New(), op)

	// Verify an error is returned
	s.Error(err, "Runtime error: Unable to start the app")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(op, eventableErr.GetOperation())

	// Verify mock was called once
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 1)
}

func (s *AwaitCompletionSuite) TestAwaitCompletionAPIError() {
	// Setup mock to return API error
	apiError := errors.New("API connection error")
	s.mockClient.On("GetRevision", s.revisionID).Return((*clienttypes.Revision)(nil), apiError)

	op := events.PublishDeployContentOp

	// Call awaitCompletion
	err := s.publisher.awaitCompletion(logging.New(), op)

	// Verify an error is returned
	s.Error(err)
	s.Contains(err.Error(), "failed to get revision status: API connection error")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(op, eventableErr.GetOperation())

	// Verify mock was called once
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 1)
}
