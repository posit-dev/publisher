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

// WaitForRevisionSuite is a test suite for testing wait_for_revision.go
type WaitForRevisionSuite struct {
	utiltest.Suite
	mockClient *connect_cloud.MockClient
	emitter    *events.CapturingEmitter
	publisher  *ServerPublisher

	// Test constants
	contentID  types.ContentID
	revisionID string
}

func TestWaitForRevisionSuite(t *testing.T) {
	suite.Run(t, new(WaitForRevisionSuite))
}

func (s *WaitForRevisionSuite) SetupSuite() {
	sleep = func(d time.Duration) {}
}

func (s *WaitForRevisionSuite) TearDownSuite() {
	sleep = time.Sleep
	since = time.Since
}

func (s *WaitForRevisionSuite) SetupTest() {
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

func (s *WaitForRevisionSuite) TestWaitForRevisionSuccess() {

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

	// Call waitForRevision
	err := s.publisher.waitForRevision(s.contentID)

	// Verify no error is returned
	s.NoError(err)

	// Verify mock was called twice
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 2)

	// Verify emitter received the success event
	s.Len(s.emitter.Events, 1, "Should have emitted 1 event (success)")
	s.Equal("publish/waitForDeployment/success", s.emitter.Events[0].Type)
	s.Equal(events.EventData{"contentId": string(s.contentID)}, s.emitter.Events[0].Data)
}

func (s *WaitForRevisionSuite) TestWaitForRevisionFailure() {
	// Setup mock to return failure
	revisionFailure := &clienttypes.Revision{
		ID:               s.revisionID,
		PublishResult:    clienttypes.PublishResultFailure,
		PublishErrorCode: "RUNTIME_ERROR",
	}

	s.mockClient.On("GetRevision", s.revisionID).Return(revisionFailure, nil)

	// Call waitForRevision
	err := s.publisher.waitForRevision(s.contentID)

	// Verify an error is returned
	s.Error(err)
	s.Contains(err.Error(), "publish failed: RUNTIME_ERROR")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(events.PublishWaitForDeploymentOp, eventableErr.GetOperation())

	// Verify mock was called once
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 1)

	// Verify no events were emitted
	s.Empty(s.emitter.Events, "Should not emit events when error occurs")
}

func (s *WaitForRevisionSuite) TestWaitForRevisionAPIError() {
	// Setup mock to return API error
	apiError := errors.New("API connection error")
	s.mockClient.On("GetRevision", s.revisionID).Return((*clienttypes.Revision)(nil), apiError)

	// Call waitForRevision
	err := s.publisher.waitForRevision(s.contentID)

	// Verify an error is returned
	s.Error(err)
	s.Contains(err.Error(), "failed to get revision status: API connection error")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(events.PublishWaitForDeploymentOp, eventableErr.GetOperation())

	// Verify mock was called once
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 1)

	// Verify no events were emitted
	s.Empty(s.emitter.Events, "Should not emit events when error occurs")
}

func (s *WaitForRevisionSuite) TestWaitForRevisionTimeout() {
	// First call returns elapsed time < maxPollTime, subsequent calls return > maxPollTime
	callCount := 0
	since = func(_ time.Time) time.Duration {
		callCount++
		if callCount == 1 {
			return 1 * time.Second // First call - continue loop
		}
		return 6 * time.Minute // Subsequent calls - exit loop due to timeout
	}

	// Setup mock to always return in-progress
	revisionInProgress := &clienttypes.Revision{
		ID:            s.revisionID,
		PublishResult: "", // Always in progress
	}

	s.mockClient.On("GetRevision", s.revisionID).Return(revisionInProgress, nil)

	// Call waitForRevision
	err := s.publisher.waitForRevision(s.contentID)

	// Verify an error is returned
	s.Error(err)
	s.Contains(err.Error(), "timed out waiting for publish to complete")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(events.PublishWaitForDeploymentOp, eventableErr.GetOperation())

	// Verify we only called the API once (then timed out on second iteration)
	s.mockClient.AssertNumberOfCalls(s.T(), "GetRevision", 1)

	// Verify no events were emitted
	s.Empty(s.emitter.Events, "Should not emit events when timeout occurs")
}
