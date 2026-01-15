package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud_upload"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// CloudSuite is a test suite for testing connect_cloud package functions
type CloudSuite struct {
	utiltest.Suite
	mockUploadClient *connect_cloud_upload.MockUploadClient
	originalFactory  func(string, logging.Logger, time.Duration) connect_cloud_upload.UploadAPIClient
	emitter          *events.CapturingEmitter
	publisher        *ServerPublisher

	// Filesystem for test isolation
	fs  afero.Fs
	dir util.AbsolutePath

	// Test constants
	contentID  types.ContentID
	bundleID   string
	revisionID string
	uploadURL  string
}

func TestCloudSuite(t *testing.T) {
	suite.Run(t, new(CloudSuite))
}

func (s *CloudSuite) SetupTest() {
	// Save original factory
	s.originalFactory = UploadAPIClientFactory

	// Set up in-memory filesystem for test isolation
	s.fs = afero.NewMemMapFs()
	s.dir = util.NewAbsolutePath("/test/dir", s.fs)
	s.dir.MkdirAll(0755)

	// Set up test constants
	s.contentID = types.ContentID("test-content-id")
	s.bundleID = "test-bundle-id"
	s.revisionID = "test-revision-id"
	s.uploadURL = "https://upload.test.url"

	// Create a mock upload client
	s.mockUploadClient = connect_cloud_upload.NewMockUploadClient()
	s.mockUploadClient.On("UploadBundle", mock.Anything).Return(nil)

	// Override factory to return our mock
	UploadAPIClientFactory = func(
		uploadURL string,
		log logging.Logger,
		timeout time.Duration) connect_cloud_upload.UploadAPIClient {
		return s.mockUploadClient
	}

	// Set up capturing emitter to verify events
	s.emitter = events.NewCapturingEmitter()

	// Create state with required fields including Dir and SaveName
	state := &state.State{
		Dir:      s.dir,
		SaveName: "test-save",
		Target:   &deployment.Deployment{},
		LocalID:  "test-local-id",
	}

	// Create a publisher helper
	helper := publishhelper.NewPublishHelper(state, logging.New())

	// Create a publisher with the content response containing the required fields
	s.publisher = &ServerPublisher{
		State:   state,
		log:     logging.New(),
		emitter: s.emitter,
		helper:  helper,
		content: &clienttypes.ContentResponse{
			ID: s.contentID,
			NextRevision: &clienttypes.Revision{
				ID:                    s.revisionID,
				SourceBundleID:        s.bundleID,
				SourceBundleUploadURL: s.uploadURL,
			},
		},
	}
}

func (s *CloudSuite) TearDownTest() {
	// Restore original factory
	UploadAPIClientFactory = s.originalFactory
}

func (s *CloudSuite) TestUploadBundle() {
	// Create a simple bundle reader
	bundleContent := []byte("test bundle content")
	bundleReader := bytes.NewReader(bundleContent)

	// Call uploadBundle
	err := s.publisher.uploadBundle(bundleReader)

	// Verify no error is returned
	s.NoError(err)

	// Verify the bundle ID was set on the target
	s.Equal(types.BundleID(s.bundleID), s.publisher.Target.BundleID)

	// Verify mock was called with the bundle reader
	s.mockUploadClient.AssertCalled(s.T(), "UploadBundle", mock.Anything)

	// Verify emitter received the expected events
	s.Len(s.emitter.Events, 2, "Should have emitted 2 events (start and success)")

	// Check start event
	s.Equal("publish/uploadBundle/start", s.emitter.Events[0].Type)
	s.Equal(events.EventData{}, s.emitter.Events[0].Data)

	// Check success event
	s.Equal("publish/uploadBundle/success", s.emitter.Events[1].Type)
	s.Equal(events.EventData{"bundleId": types.BundleID("test-bundle-id")}, s.emitter.Events[1].Data)
}

func (s *CloudSuite) TestUploadBundleError() {
	// Create a mock error
	mockError := errors.New("upload failed")

	// Clear existing expectations and set new one to return error
	s.mockUploadClient.ExpectedCalls = nil
	s.mockUploadClient.On("UploadBundle", mock.Anything).Return(mockError)

	// Create a simple bundle reader
	bundleContent := []byte("test bundle content")
	bundleReader := bytes.NewReader(bundleContent)

	// Call uploadBundle
	err := s.publisher.uploadBundle(bundleReader)

	// Verify an error is returned
	s.Error(err)

	// Verify it's the expected operation error
	s.Contains(err.Error(), "bundle upload failed: upload failed")

	// Check that it's an EventableError with correct operation
	eventableErr, ok := err.(types.EventableError)
	s.True(ok, "Error should implement EventableError interface")
	s.Equal(events.PublishUploadBundleOp, eventableErr.GetOperation())

	// Verify it's specifically an AgentError
	agentErr, isAgentErr := types.IsAgentError(err)
	s.True(isAgentErr, "Error should be an AgentError")
	s.Equal(types.ErrorUnknown, agentErr.Code)

	// Verify mock was called with the bundle reader
	s.mockUploadClient.AssertCalled(s.T(), "UploadBundle", mock.Anything)

	// Verify emitter only received the start event (no success event)
	s.Len(s.emitter.Events, 1, "Should have emitted only 1 event (start)")

	// Check start event
	s.Equal("publish/uploadBundle/start", s.emitter.Events[0].Type)
	s.Equal(events.EventData{}, s.emitter.Events[0].Data)
}
