package connect

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type SetEnvVarsSuite struct {
	utiltest.Suite
}

func TestSetEnvVarsSuite(t *testing.T) {
	suite.Run(t, new(SetEnvVarsSuite))
}

func (s *SetEnvVarsSuite) TestSetEnvVarsWithNoEnvironmentOrSecrets() {
	stateStore := state.Empty()
	log := logging.New()
	emitter := events.NewCapturingEmitter()

	client := connect.NewMockClient()
	publisher := &ServerPublisher{
		State:   stateStore,
		log:     log,
		emitter: emitter,
		client:  client,
	}

	err := publisher.setEnvVars(types.ContentID("test-content-id"))
	s.NoError(err)

	// No calls to the Connect API to set environment variables should be made
	s.Equal(0, len(client.Calls))
}

func (s *SetEnvVarsSuite) TestSetEnvVarsWithSecrets() {
	stateStore := state.Empty()
	log := logging.New()
	emitter := events.NewCapturingEmitter()

	stateStore.Secrets = map[string]string{"SOME_SECRET": "some-secret-value", "ANOTHER_SECRET": "another-secret-value"}

	client := connect.NewMockClient()
	publisher := &ServerPublisher{
		State:   stateStore,
		log:     log,
		emitter: emitter,
		client:  client,
	}

	client.On("SetEnvVars", types.ContentID("test-content-id"), stateStore.Secrets, mock.Anything).Return(nil)

	err := publisher.setEnvVars(types.ContentID("test-content-id"))
	s.NoError(err)

	client.AssertExpectations(s.T())
}

func (s *SetEnvVarsSuite) TestSetEnvVarsWithEnvironment() {
	stateStore := state.Empty()
	log := logging.New()
	emitter := events.NewCapturingEmitter()

	stateStore.Config.Environment = map[string]string{"TEST_ENV_VAR": "test-value", "ANOTHER_TEST_ENV_VAR": "another-test-value"}

	client := connect.NewMockClient()
	publisher := &ServerPublisher{
		State:   stateStore,
		log:     log,
		emitter: emitter,
		client:  client,
	}

	client.On("SetEnvVars", types.ContentID("test-content-id"), stateStore.Config.Environment, mock.Anything).Return(nil)

	err := publisher.setEnvVars(types.ContentID("test-content-id"))
	s.NoError(err)

	client.AssertExpectations(s.T())
}

func (s *SetEnvVarsSuite) TestSetEnvVarsWithSecretsAndEnvironment() {
	stateStore := state.Empty()
	stateStore.Config.Environment = map[string]string{"TEST_ENV_VAR": "test-value", "ANOTHER_TEST_ENV_VAR": "another-test-value"}
	stateStore.Secrets = map[string]string{"SOME_SECRET": "some-secret-value", "ANOTHER_SECRET": "another-secret-value"}
	log := logging.New()
	emitter := events.NewCapturingEmitter()

	client := connect.NewMockClient()
	publisher := &ServerPublisher{
		State:   stateStore,
		log:     log,
		emitter: emitter,
		client:  client,
	}

	combinedEnv := map[string]string{
		"TEST_ENV_VAR":         "test-value",
		"ANOTHER_TEST_ENV_VAR": "another-test-value",
		"SOME_SECRET":          "some-secret-value",
		"ANOTHER_SECRET":       "another-secret-value",
	}
	client.On("SetEnvVars", types.ContentID("test-content-id"), combinedEnv, mock.Anything).Return(nil)

	err := publisher.setEnvVars(types.ContentID("test-content-id"))
	s.NoError(err)

	client.AssertExpectations(s.T())
}
