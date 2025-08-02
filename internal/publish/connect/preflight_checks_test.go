package connect

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type PreFlightChecksSuite struct {
	utiltest.Suite
	state    *state.State
	log      logging.Logger
	emitter  *events.CapturingEmitter
	client   *connect.MockClient
	fs       afero.Fs
	helper   *publishhelper.PublishHelper
	dir      util.AbsolutePath
	testPath util.AbsolutePath
}

func TestPreFlightChecksSuite(t *testing.T) {
	suite.Run(t, new(PreFlightChecksSuite))
}

func (s *PreFlightChecksSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	s.dir = util.NewAbsolutePath("/test/dir", s.fs)
	s.testPath = s.dir.Join("test_deployment.toml")
	s.dir.MkdirAll(0755)

	// Set up base objects
	s.log = logging.NewDiscardLogger()
	s.emitter = events.NewCapturingEmitter()
	s.client = connect.NewMockClient()

	// Create state with required properties
	s.state = &state.State{
		Dir:         s.dir,
		AccountName: "test-account",
		ConfigName:  "test-config",
		TargetName:  "test-target",
		SaveName:    "test-save-name",
		Account: &accounts.Account{
			Name: "test-account",
			URL:  "https://connect.example.com",
		},
		Config: &config.Config{
			Title: "Test Content",
		},
		Target:  deployment.New(),
		LocalID: "test-local-id",
	}

	// Create publisher helper
	s.helper = publishhelper.NewPublishHelper(s.state, s.log)
}

func (s *PreFlightChecksSuite) createServerPublisher() *ServerPublisher {
	return &ServerPublisher{
		State:   s.state,
		log:     s.log,
		emitter: s.emitter,
		client:  s.client,
		helper:  s.helper,
	}
}

func (s *PreFlightChecksSuite) TestPreFlightChecksSuccess() {
	// Mock data
	testUser := &connect.User{
		Username:  "test-user",
		Email:     "test@example.com",
		FirstName: "Test",
		LastName:  "User",
	}

	// Set up mock client
	s.client.On("TestAuthentication", mock.Anything).Return(testUser, nil)
	s.client.On("CheckCapabilities",
		s.dir,
		s.state.Config,
		mock.AnythingOfType("*types.ContentID"),
		mock.Anything,
	).Return(nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.PreFlightChecks()

	// Verify results
	s.NoError(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/checkCapabilities/start", s.emitter.Events[0].Type)
	s.Equal("publish/checkCapabilities/success", s.emitter.Events[1].Type)
}

func (s *PreFlightChecksSuite) TestPreFlightChecksWithExistingContentID() {
	// Mock data
	testUser := &connect.User{
		Username:  "test-user",
		Email:     "test@example.com",
		FirstName: "Test",
		LastName:  "User",
	}
	contentID := types.ContentID("test-content-id")

	// Set existing content ID
	s.state.Target.ID = contentID

	// Set up mock client
	s.client.On("TestAuthentication", mock.Anything).Return(testUser, nil)
	s.client.On("CheckCapabilities",
		s.dir,
		s.state.Config,
		mock.AnythingOfType("*types.ContentID"),
		mock.Anything,
	).Return(nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.PreFlightChecks()

	// Verify results
	s.NoError(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/checkCapabilities/start", s.emitter.Events[0].Type)
	s.Equal("publish/checkCapabilities/success", s.emitter.Events[1].Type)
}

func (s *PreFlightChecksSuite) TestPreFlightChecksAuthenticationFailure() {
	// Set up mock client to return an error on authentication
	mockError := types.NewAgentError(types.ErrorUnknown, nil, nil)
	s.client.On("TestAuthentication", mock.Anything).Return(nil, mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.PreFlightChecks()

	// Verify results
	s.Error(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify only start event was emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/checkCapabilities/start", s.emitter.Events[0].Type)
}

func (s *PreFlightChecksSuite) TestPreFlightChecksCapabilitiesFailure() {
	// Mock data
	testUser := &connect.User{
		Username:  "test-user",
		Email:     "test@example.com",
		FirstName: "Test",
		LastName:  "User",
	}

	// Set up mock client with authentication success but capabilities failure
	s.client.On("TestAuthentication", mock.Anything).Return(testUser, nil)
	mockError := types.NewAgentError(types.ErrorUnknown, nil, nil)
	s.client.On("CheckCapabilities",
		s.dir,
		s.state.Config,
		mock.AnythingOfType("*types.ContentID"),
		mock.Anything,
	).Return(mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.PreFlightChecks()

	// Verify results
	s.Error(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify only start event was emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/checkCapabilities/start", s.emitter.Events[0].Type)
}
