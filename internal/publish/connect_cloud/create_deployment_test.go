package connect_cloud

import (
	"testing"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	internal_types "github.com/posit-dev/publisher/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock implementation of connect_cloud.APIClient
type MockCloudClient struct {
	mock.Mock
}

func (m *MockCloudClient) GetCurrentUser() (*connect_cloud.UserResponse, error) {
	args := m.Called()
	return args.Get(0).(*connect_cloud.UserResponse), args.Error(1)
}

func (m *MockCloudClient) GetAccounts() (*connect_cloud.AccountListResponse, error) {
	args := m.Called()
	return args.Get(0).(*connect_cloud.AccountListResponse), args.Error(1)
}

func (m *MockCloudClient) CreateContent(request *types.CreateContentRequest) (*types.ContentResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.ContentResponse), args.Error(1)
}

func (m *MockCloudClient) UpdateContent(request *types.UpdateContentRequest) (*types.ContentResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.ContentResponse), args.Error(1)
}

func (m *MockCloudClient) GetAuthorization(request *types.AuthorizationRequest) (*types.AuthorizationResponse, error) {
	args := m.Called(request)
	return args.Get(0).(*types.AuthorizationResponse), args.Error(1)
}

func (m *MockCloudClient) GetRevision(revisionID string) (*types.Revision, error) {
	args := m.Called(revisionID)
	return args.Get(0).(*types.Revision), args.Error(1)
}

func (m *MockCloudClient) PublishContent(contentID string) error {
	args := m.Called(contentID)
	return args.Error(0)
}

// Mock implementation of events.Emitter
type MockEmitter struct {
	mock.Mock
}

func (m *MockEmitter) Emit(event events.Event) {
	m.Called(event)
}

func TestCreateDeployment(t *testing.T) {
	// Create mocks
	mockClient := new(MockCloudClient)
	mockEmitter := new(MockEmitter)

	// Setup expected client behavior
	mockContentResponse := &types.ContentResponse{
		ID:                    "test-content-id",
		SourceBundleID:        "test-bundle-id",
		SourceBundleUploadURL: "https://upload.url/path",
	}
	mockClient.On("CreateContent", mock.Anything).Return(mockContentResponse, nil)

	// Setup expected emitter behavior (start and success events)
	mockEmitter.On("Emit", mock.Anything).Return()

	// Create test state
	testState := &state.State{
		SaveName: "test-app",
		Config: &internal_types.SourceConfig{
			Title:       "Test Title",
			Description: "Test Description",
		},
	}

	// Create helper with account data
	helper := &publishhelper.PublishHelper{
		Account: &internal_types.Account{
			AccountID:    "test-account-id",
			Organization: "test-org",
			URL:          "https://api.connect.posit.cloud",
		},
	}

	// Create the server publisher with mocked dependencies
	publisher := NewServerPublisher(testState, &internal_types.NoOpLogger{}, mockClient, mockEmitter, helper)

	// Call the method being tested
	contentID, err := publisher.CreateDeployment()

	// Verify results
	assert.NoError(t, err)
	assert.Equal(t, internal_types.ContentID("test-content-id"), contentID)
	assert.Equal(t, mockContentResponse, publisher.content)

	// Verify mocks were called as expected
	mockClient.AssertExpectations(t)
	mockEmitter.AssertExpectations(t)
}

func TestCreateDeploymentError(t *testing.T) {
	// Create mocks
	mockClient := new(MockCloudClient)
	mockEmitter := new(MockEmitter)

	// Setup expected client behavior - return an error
	mockClient.On("CreateContent", mock.Anything).Return(&types.ContentResponse{}, assert.AnError)

	// Setup expected emitter behavior (only start event)
	mockEmitter.On("Emit", mock.Anything).Return()

	// Create test state
	testState := &state.State{
		SaveName: "test-app",
		Config: &internal_types.SourceConfig{
			Title:       "Test Title",
			Description: "Test Description",
		},
	}

	// Create helper with account data
	helper := &publishhelper.PublishHelper{
		Account: &internal_types.Account{
			AccountID:    "test-account-id",
			Organization: "test-org",
			URL:          "https://api.connect.posit.cloud",
		},
	}

	// Create the server publisher with mocked dependencies
	publisher := NewServerPublisher(testState, &internal_types.NoOpLogger{}, mockClient, mockEmitter, helper)

	// Call the method being tested
	_, err := publisher.CreateDeployment()

	// Verify results
	assert.Error(t, err)

	// Verify mocks were called as expected
	mockClient.AssertExpectations(t)
	mockEmitter.AssertExpectations(t)
}
