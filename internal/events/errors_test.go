package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"os"
	"syscall"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2023 by Posit Software, PBC.

type EventsSuite struct {
	utiltest.Suite
}

func TestEventsSuite(t *testing.T) {
	suite.Run(t, new(EventsSuite))
}

func (s *EventsSuite) TestGoError() {
	err := errors.New("an error occurred")
	agentErr := ErrToAgentError(OpPublishRestoreREnv, err)
	event := agentErr.ToEvent()

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(EventData{
		"Msg": "an error occurred",
	}, event.Data)
}

func (s *EventsSuite) TestGoErrorWithAttrs() {
	_, err := os.Stat("/nonexistent")
	s.NotNil(err)
	agentErr := ErrToAgentError(OpPublishRestoreREnv, err)
	event := agentErr.ToEvent()

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restoreREnv/failure/unknown", event.Type)
	s.Equal(EventData{
		"Err":  syscall.Errno(2),
		"Msg":  "stat /nonexistent: no such file or directory",
		"Op":   "stat",
		"Path": "/nonexistent",
	}, event.Data)
}

func (s *EventsSuite) TestErrorDetails() {
	// in the callee
	err := errors.New("An internal publishing server error occurred")
	details := HTTPErrorDetails{Status: 500}
	returnedErr := NewAgentError(ServerError, err, details)

	// in the caller
	agentErr := ErrToAgentError(OpPublishRestorePythonEnv, returnedErr)
	event := agentErr.ToEvent()

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restorePythonEnv/failure/serverError", event.Type)
	s.Equal(EventData{
		"Msg":    "An internal publishing server error occurred",
		"Status": 500,
	}, event.Data)
}

func (s *EventsSuite) TestErrorObjectAndDetails() {
	// in the callee (note, an HTTPErrorDetails and an os.PathError don't go together,
	// we just need a details object and an error that is a struct)
	_, err := os.Stat("/nonexistent")
	details := HTTPErrorDetails{Status: 500}
	returnedErr := NewAgentError(ServerError, err, details)

	// in the caller
	agentErr := ErrToAgentError(OpPublishRestorePythonEnv, returnedErr)
	event := agentErr.ToEvent()

	s.NotEqual(time.Time{}, event.Time)
	s.Equal("publish/restorePythonEnv/failure/serverError", event.Type)
	s.Equal(EventData{
		"Err":    syscall.Errno(2),
		"Msg":    "stat /nonexistent: no such file or directory",
		"Op":     "stat",
		"Path":   "/nonexistent",
		"Status": 500,
	}, event.Data)
}

func (s *EventsSuite) TestError() {
	err := errors.New("an error occurred")
	agentErr := ErrToAgentError(OpPublishRestoreREnv, err)
	s.Equal(err.Error(), agentErr.Error())
}
