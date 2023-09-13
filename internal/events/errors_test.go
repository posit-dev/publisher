package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"syscall"
	"testing"
	"time"

	"github.com/rstudio/publishing-client/internal/types"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
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
	agentErr := types.ErrToAgentError(PublishRestoreREnvOp, err)
	event := NewAgentEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(EventData{
		"msg": "an error occurred",
	}, event.Data)
}

func (s *ErrorsSuite) TestGoErrorWithAttrs() {
	_, err := os.Stat("/nonexistent")
	s.NotNil(err)
	agentErr := types.ErrToAgentError(PublishRestoreREnvOp, err)
	event := NewAgentEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(EventData{
		"msg":  "stat /nonexistent: no such file or directory",
		"Err":  syscall.Errno(2),
		"Op":   "stat",
		"Path": "/nonexistent",
	}, event.Data)
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
	agentErr := types.ErrToAgentError(PublishRestorePythonEnvOp, returnedErr)
	event := NewAgentEvent(agentErr)

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
	agentErr := types.ErrToAgentError(PublishRestorePythonEnvOp, returnedErr)
	event := NewAgentEvent(agentErr)

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restorePythonEnv/failure/serverErr", event.Type)
	s.Equal(EventData{
		"msg":    "stat /nonexistent: no such file or directory",
		"Err":    syscall.Errno(2),
		"Op":     "stat",
		"Path":   "/nonexistent",
		"Status": 500,
	}, event.Data)
}
