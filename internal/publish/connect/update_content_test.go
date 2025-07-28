package connect

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/clients/http_client"
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

type UpdateContentSuite struct {
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

func TestUpdateContentSuite(t *testing.T) {
	suite.Run(t, new(UpdateContentSuite))
}

func (s *UpdateContentSuite) SetupTest() {
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
			Title:       "Test Content",
			Description: "Test content description",
		},
		Target:  deployment.New(),
		LocalID: "test-local-id",
	}

	// Create publisher helper
	s.helper = publishhelper.NewPublishHelper(s.state, s.log)
}

func (s *UpdateContentSuite) createServerPublisher() *ServerPublisher {
	return &ServerPublisher{
		State:   s.state,
		log:     s.log,
		emitter: s.emitter,
		client:  s.client,
		helper:  s.helper,
	}
}

func (s *UpdateContentSuite) TestUpdateContentSuccess() {
	// Mock data
	contentID := types.ContentID("test-content-id")

	// Set up mock client
	s.client.On("UpdateDeployment",
		contentID,
		mock.AnythingOfType("*connect.ConnectContent"),
		mock.Anything, // logger
	).Return(nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.updateContent(contentID)

	// Verify results
	s.NoError(err)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/createDeployment/start", s.emitter.Events[0].Type)
	s.Equal("publish/createDeployment/success", s.emitter.Events[1].Type)

	// Verify the event data contains the correct values
	s.Equal(contentID, s.emitter.Events[0].Data["contentId"])
	s.Equal("test-save-name", s.emitter.Events[0].Data["saveName"])
}

func (s *UpdateContentSuite) TestUpdateContentGenericError() {
	// Mock data
	contentID := types.ContentID("test-content-id")

	// Set up mock client to return an error
	mockError := errors.New("update failed")
	s.client.On("UpdateDeployment",
		contentID,
		mock.AnythingOfType("*connect.ConnectContent"),
		mock.Anything, // logger
	).Return(mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.updateContent(contentID)

	// Verify results
	s.Error(err)
	s.Contains(err.Error(), "update failed")

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify only start event was emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/createDeployment/start", s.emitter.Events[0].Type)
}

func (s *UpdateContentSuite) TestUpdateContentNotFoundError() {
	// Mock data
	contentID := types.ContentID("test-content-id")

	// Create a 404 HTTP error
	httpError := http_client.NewHTTPError(
		"https://connect.example.com/api/content/test-content-id",
		"PUT",
		http.StatusNotFound,
		"uh oh",
	)

	// Set up mock client to return an error
	s.client.On("UpdateDeployment",
		contentID,
		mock.AnythingOfType("*connect.ConnectContent"),
		mock.Anything, // logger
	).Return(httpError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	err := publisher.updateContent(contentID)

	// Verify results
	s.Error(err)

	// The error should be of type AgentError with code DeploymentNotFoundCode
	agentErr, isAgentErr := err.(*types.AgentError)
	s.True(isAgentErr)
	s.Equal(events.DeploymentNotFoundCode, agentErr.GetCode())

	// The error details should contain the content ID
	s.Equal(contentID, agentErr.GetData()["contentId"])

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify only start event was emitted
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/createDeployment/start", s.emitter.Events[0].Type)
}
