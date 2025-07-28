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

type CreateDeploymentSuite struct {
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

func TestCreateDeploymentSuite(t *testing.T) {
	suite.Run(t, new(CreateDeploymentSuite))
}

func (s *CreateDeploymentSuite) SetupTest() {
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

func (s *CreateDeploymentSuite) createServerPublisher() *ServerPublisher {
	return &ServerPublisher{
		State:   s.state,
		log:     s.log,
		emitter: s.emitter,
		client:  s.client,
		helper:  s.helper,
	}
}

func (s *CreateDeploymentSuite) TestCreateDeploymentSuccess() {
	// Mock data
	expectedContentID := types.ContentID("test-content-id")

	// Set up mock client
	s.client.On("CreateDeployment",
		mock.AnythingOfType("*connect.ConnectContent"),
		mock.Anything, // logger
	).Return(expectedContentID, nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	contentID, err := publisher.CreateDeployment()

	// Verify results
	s.NoError(err)
	s.Equal(expectedContentID, contentID)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/createNewDeployment/start", s.emitter.Events[0].Type)
	s.Equal("publish/createNewDeployment/success", s.emitter.Events[1].Type)

	// Verify the event data contains the correct values
	s.Equal("test-save-name", s.emitter.Events[0].Data["saveName"])
	s.Equal("test-save-name", s.emitter.Events[1].Data["saveName"])
	s.Equal(expectedContentID, s.emitter.Events[1].Data["contentId"])
}

func (s *CreateDeploymentSuite) TestCreateDeploymentFailure() {
	// Set up mock client to return an error
	mockError := types.NewAgentError(types.ErrorUnknown, nil, nil)
	s.client.On("CreateDeployment",
		mock.AnythingOfType("*connect.ConnectContent"),
		mock.Anything, // logger
	).Return(types.ContentID(""), mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	contentID, err := publisher.CreateDeployment()

	// Verify results
	s.Error(err)
	s.Equal(types.ContentID(""), contentID)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events - only start event should be emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/createNewDeployment/start", s.emitter.Events[0].Type)

	// Verify the event data contains the correct values
	s.Equal("test-save-name", s.emitter.Events[0].Data["saveName"])
}
