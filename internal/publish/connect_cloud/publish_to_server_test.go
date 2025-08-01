package connect_cloud

import (
	"bytes"
	"io"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	internal_types "github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUploadAPIClient is a mock implementation of connect_cloud_upload.UploadAPIClient
type MockUploadAPIClient struct {
	mock.Mock
}

func (m *MockUploadAPIClient) UploadBundle(bundleContent io.Reader) error {
	args := m.Called(bundleContent)
	return args.Error(0)
}

// Patch the NewConnectCloudUploadClient function for testing
func patchNewConnectCloudUploadClient(uploadClient *MockUploadAPIClient) func() {
	oldNewUploadClient := connectCloudUploadClientConstructor
	connectCloudUploadClientConstructor = func(uploadURL string, log internal_types.Logger, timeout time.Duration) interface{} {
		return uploadClient
	}
	return func() {
		connectCloudUploadClientConstructor = oldNewUploadClient
	}
}

// Global variable to allow patching for tests
var connectCloudUploadClientConstructor = func(uploadURL string, log internal_types.Logger, timeout time.Duration) interface{} {
	// This will be replaced with MockUploadAPIClient during tests
	return nil
}

func TestPublishToServer_UpdateAndPublish(t *testing.T) {
	// Create mocks
	mockClient := new(MockCloudClient)
	mockEmitter := new(MockEmitter)
	mockUploadClient := new(MockUploadAPIClient)

	// Setup patch for upload client constructor
	unpatch := patchNewConnectCloudUploadClient(mockUploadClient)
	defer unpatch()

	// Create content response with revision
	revision := &types.Revision{
		ID: "test-revision-id",
	}
	contentResponse := &types.ContentResponse{
		ID:                    "test-content-id",
		SourceBundleID:        "test-bundle-id",
		SourceBundleUploadURL: "https://upload.url/path",
		NextRevision:          revision,
	}

	// Setup mock client expectations
	mockClient.On("UpdateContent", mock.Anything).Return(contentResponse, nil)
	mockClient.On("PublishContent", "test-content-id").Return(nil)
	
	// First GetRevision returns no result (still publishing)
	noResultRevision := &types.Revision{
		ID:            "test-revision-id",
		PublishResult: "",
	}
	mockClient.On("GetRevision", "test-revision-id").Return(noResultRevision, nil).Once()
	
	// Second GetRevision returns success
	successRevision := &types.Revision{
		ID:            "test-revision-id",
		PublishResult: types.PublishResultSuccess,
	}
	mockClient.On("GetRevision", "test-revision-id").Return(successRevision, nil).Once()
	
	// Setup mock upload client
	mockUploadClient.On("UploadBundle", mock.Anything).Return(nil)
	
	// Setup mock emitter
	mockEmitter.On("Emit", mock.Anything).Return()

	// Create test state and helper
	testState := &state.State{
		Config: &internal_types.SourceConfig{
			Title:       "Test Title",
			Description: "Test Description",
		},
	}
	helper := &publishhelper.PublishHelper{
		Account: &internal_types.Account{},
	}

	// Create the server publisher
	publisher := &ServerPublisher{
		State:   testState,
		log:     &internal_types.NoOpLogger{},
		client:  mockClient,
		emitter: mockEmitter,
		helper:  helper,
	}

	// Test bundle content
	bundleContent := bytes.NewBufferString("test bundle content")

	// Call the method being tested
	err := publisher.PublishToServer("test-content-id", bundleContent)

	// Verify results
	assert.NoError(t, err)

	// Verify mocks were called as expected
	mockClient.AssertExpectations(t)
	mockEmitter.AssertExpectations(t)
	mockUploadClient.AssertExpectations(t)
}

func TestPublishToServer_WithExistingContent(t *testing.T) {
	// Create mocks
	mockClient := new(MockCloudClient)
	mockEmitter := new(MockEmitter)
	mockUploadClient := new(MockUploadAPIClient)

	// Setup patch for upload client constructor
	unpatch := patchNewConnectCloudUploadClient(mockUploadClient)
	defer unpatch()

	// Create content response with revision
	revision := &types.Revision{
		ID: "test-revision-id",
	}
	contentResponse := &types.ContentResponse{
		ID:                    "test-content-id",
		SourceBundleID:        "test-bundle-id",
		SourceBundleUploadURL: "https://upload.url/path",
		NextRevision:          revision,
	}

	// Setup mock client expectations - don't expect UpdateContent since we have content
	mockClient.On("PublishContent", "test-content-id").Return(nil)
	
	// GetRevision returns success immediately
	successRevision := &types.Revision{
		ID:            "test-revision-id",
		PublishResult: types.PublishResultSuccess,
	}
	mockClient.On("GetRevision", "test-revision-id").Return(successRevision, nil)
	
	// Setup mock upload client
	mockUploadClient.On("UploadBundle", mock.Anything).Return(nil)
	
	// Setup mock emitter
	mockEmitter.On("Emit", mock.Anything).Return()

	// Create test state and helper
	testState := &state.State{}
	helper := &publishhelper.PublishHelper{}

	// Create the server publisher with existing content
	publisher := &ServerPublisher{
		State:   testState,
		log:     &internal_types.NoOpLogger{},
		client:  mockClient,
		emitter: mockEmitter,
		helper:  helper,
		content: contentResponse, // Set existing content
	}

	// Test bundle content
	bundleContent := bytes.NewBufferString("test bundle content")

	// Call the method being tested
	err := publisher.PublishToServer("test-content-id", bundleContent)

	// Verify results
	assert.NoError(t, err)

	// Verify UpdateContent was not called
	mockClient.AssertNotCalled(t, "UpdateContent")

	// Verify other mocks were called as expected
	mockClient.AssertExpectations(t)
	mockEmitter.AssertExpectations(t)
	mockUploadClient.AssertExpectations(t)
}

func TestPublishToServer_PublishFailure(t *testing.T) {
	// Create mocks
	mockClient := new(MockCloudClient)
	mockEmitter := new(MockEmitter)
	mockUploadClient := new(MockUploadAPIClient)

	// Setup patch for upload client constructor
	unpatch := patchNewConnectCloudUploadClient(mockUploadClient)
	defer unpatch()

	// Create content response with revision
	revision := &types.Revision{
		ID: "test-revision-id",
	}
	contentResponse := &types.ContentResponse{
		ID:                    "test-content-id",
		SourceBundleID:        "test-bundle-id",
		SourceBundleUploadURL: "https://upload.url/path",
		NextRevision:          revision,
	}

	// Setup mock client expectations
	mockClient.On("UpdateContent", mock.Anything).Return(contentResponse, nil)
	mockClient.On("PublishContent", "test-content-id").Return(nil)
	
	// GetRevision returns failure
	failureRevision := &types.Revision{
		ID:               "test-revision-id",
		PublishResult:    types.PublishResultFailure,
		PublishErrorCode: "TEST_ERROR",
	}
	mockClient.On("GetRevision", "test-revision-id").Return(failureRevision, nil)
	
	// Setup mock upload client
	mockUploadClient.On("UploadBundle", mock.Anything).Return(nil)
	
	// Setup mock emitter
	mockEmitter.On("Emit", mock.Anything).Return()

	// Create test state and helper
	testState := &state.State{
		Config: &internal_types.SourceConfig{},
	}
	helper := &publishhelper.PublishHelper{
		Account: &internal_types.Account{},
	}

	// Create the server publisher
	publisher := &ServerPublisher{
		State:   testState,
		log:     &internal_types.NoOpLogger{},
		client:  mockClient,
		emitter: mockEmitter,
		helper:  helper,
	}

	// Test bundle content
	bundleContent := bytes.NewBufferString("test bundle content")

	// Call the method being tested
	err := publisher.PublishToServer("test-content-id", bundleContent)

	// Verify results
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "publish failed: TEST_ERROR")

	// Verify mocks were called as expected
	mockClient.AssertExpectations(t)
	mockEmitter.AssertExpectations(t)
	mockUploadClient.AssertExpectations(t)
}