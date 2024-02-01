package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"syscall"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ErrorsSuite struct {
	utiltest.Suite
}

func TestErrorsSuite(t *testing.T) {
	suite.Run(t, new(ErrorsSuite))
}

func (s *ErrorsSuite) TestGoError() {
	err := errors.New("an error occurred")
	agentErr := types.OperationError(PublishRestoreREnvOp, err)
	event := NewErrorEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(EventData{
		"msg": "an error occurred",
	}, event.Data)
}

func (s *ErrorsSuite) TestGoErrorWithAttrs() {
	_, err := os.Stat("/nonexistent")
	s.NotNil(err)
	agentErr := types.OperationError(PublishRestoreREnvOp, err)
	event := NewErrorEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(syscall.Errno(2), event.Data["Err"])
	s.Equal("/nonexistent", event.Data["Path"])
}

type testErrorDetails struct {
	Status int
}

func (s *ErrorsSuite) TestErrorDetails() {
	// in the callee
	err := errors.New("An internal publishing server error occurred")
	details := testErrorDetails{Status: 500}
	returnedErr := types.NewAgentError(ServerErrorCode, err, details)

	// in the caller
	agentErr := types.OperationError(PublishRestorePythonEnvOp, returnedErr)
	event := NewErrorEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restorePythonEnv/failure/serverErr", event.Type)
	s.Equal(EventData{
		"msg":    "An internal publishing server error occurred",
		"Status": 500,
	}, event.Data)
}

func (s *ErrorsSuite) TestErrorObjectAndDetails() {
	// in the callee
	_, err := os.Stat("/nonexistent")
	details := testErrorDetails{Status: 500}
	returnedErr := types.NewAgentError(ServerErrorCode, err, details)

	// in the caller
	agentErr := types.OperationError(PublishRestorePythonEnvOp, returnedErr)
	event := NewErrorEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restorePythonEnv/failure/serverErr", event.Type)
	s.Equal(syscall.Errno(2), event.Data["Err"])
	s.Equal("/nonexistent", event.Data["Path"])
	s.Equal(500, event.Data["Status"])
}
