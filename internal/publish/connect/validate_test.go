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

type ValidateContentSuite struct {
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

func TestValidateContentSuite(t *testing.T) {
	suite.Run(t, new(ValidateContentSuite))
}

func (s *ValidateContentSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	s.dir = util.NewAbsolutePath("/test/dir", s.fs)
	s.testPath = s.dir.Join("test_deployment.toml")
	s.dir.MkdirAll(0755)

	// Set up base objects
	s.log = logging.NewDiscardLogger()
	s.emitter = events.NewCapturingEmitter()
	s.client = connect.NewMockClient()

	// Create state with required properties
	contentID := types.ContentID("test-content-id")
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
			Title:       "Test Content",
			Description: "Test content description",
		},
		Target: &deployment.Deployment{
			ID: contentID,
		},
		LocalID: "test-local-id",
	}

	// Create publisher helper
	s.helper = publishhelper.NewPublishHelper(s.state, s.log)
}

func (s *ValidateContentSuite) createServerPublisher() *ServerPublisher {
	return &ServerPublisher{
		State:   s.state,
		log:     s.log,
		emitter: s.emitter,
		client:  s.client,
		helper:  s.helper,
	}
}

func (s *ValidateContentSuite) TestValidateContentSuccess() {
	// Mock data
	contentID := types.ContentID("test-content-id")

	// Set up mock client
	s.client.On("ValidateDeployment",
		contentID,
		mock.Anything, // logger
	).Return(nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.validateContent(contentID)

	// Verify results
	s.NoError(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/validateDeployment/start", s.emitter.Events[0].Type)
	s.Equal("publish/validateDeployment/success", s.emitter.Events[1].Type)

	// Verify the event data contains the direct URL
	s.Contains(s.emitter.Events[0].Data, "url")
	s.Contains(s.emitter.Events[0].Data["url"].(string), "connect.example.com")
	s.Contains(s.emitter.Events[0].Data["url"].(string), "test-content-id")
}

func (s *ValidateContentSuite) TestValidateContentFailure() {
	// Mock data
	contentID := types.ContentID("test-content-id")

	// Set up mock client to return an error
	mockError := types.NewAgentError(types.ErrorDeployedContentNotRunning, nil, nil)
	s.client.On("ValidateDeployment",
		contentID,
		mock.Anything, // logger
	).Return(mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.validateContent(contentID)

	// Verify results
	s.Error(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify only start event was emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/validateDeployment/start", s.emitter.Events[0].Type)

	// Verify the event data contains the direct URL
	s.Contains(s.emitter.Events[0].Data, "url")
}
