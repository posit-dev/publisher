package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"log/slog"
	"testing"

	"github.com/rstudio/publishing-client/internal/types"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type LoggingSuite struct {
	utiltest.Suite
}

func TestLoggingSuite(t *testing.T) {
	suite.Run(t, new(LoggingSuite))
}

func (s *LoggingSuite) TestDefaultLogger() {
	log := New().(logger)
	s.NotNil(log.BaseLogger)
}

func (s *LoggingSuite) TestFromStdLogger() {
	stdLogger := slog.Default()
	log := FromStdLogger(stdLogger).(logger)
	s.NotNil(log.BaseLogger)
	s.Equal(stdLogger, log.BaseLogger)
}

func (s *LoggingSuite) TestStart() {
	baseLogger := NewMockBaseLogger()
	baseLogger.On("Info", "message", LogKeyPhase, StartPhase, "arg", "value")

	log := logger{baseLogger}
	log.Start("message", "arg", "value")
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestSuccess() {
	baseLogger := NewMockBaseLogger()
	baseLogger.On("Info", "message", LogKeyPhase, SuccessPhase, "arg", "value")

	log := logger{baseLogger}
	log.Success("message", "arg", "value")
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestStatus() {
	baseLogger := NewMockBaseLogger()
	baseLogger.On("Info", "message", LogKeyPhase, ProgressPhase, "arg", "value")

	log := logger{baseLogger}
	log.Status("message", "arg", "value")
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestProgress() {
	baseLogger := NewMockBaseLogger()
	baseLogger.On(
		"Info", "message",
		LogKeyPhase, ProgressPhase,
		"done", float32(20),
		"total", float32(100),
		"arg", "value")

	log := logger{baseLogger}
	log.Progress("message", 20, 100, "arg", "value")
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestFailureGoError() {
	baseLogger := NewMockBaseLogger()
	baseLogger.On("Error", "test error", LogKeyPhase, FailurePhase)
	baseLogger.On("Debug", mock.AnythingOfType("string"))

	log := logger{baseLogger}
	err := errors.New("test error")
	log.Failure(err)
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestFailureAgentError() {
	baseLogger := NewMockBaseLogger()
	op := types.Operation("testOp")

	baseLogger.On(
		"Error", "test error",
		LogKeyOp, op,
		LogKeyPhase, FailurePhase,
		LogKeyErrCode, types.UnknownErrorCode,
		"Metadata", "some metadata")

	log := logger{baseLogger}
	baseErr := errors.New("test error")
	errData := struct {
		Metadata string
	}{"some metadata"}
	err := types.NewAgentError(types.UnknownErrorCode, baseErr, &errData)
	err.SetOperation(op)
	log.Failure(err)
	baseLogger.AssertExpectations(s.T())
}

func (s *LoggingSuite) TestWith() {
	baseLogger := NewMockBaseLogger()
	expectedLogger := slog.Default()
	baseLogger.On("With", "arg", "value", "arg2", "value2").Return(expectedLogger)
	log := logger{baseLogger}
	actualLogger := log.WithArgs("arg", "value", "arg2", "value2")
	s.Equal(logger{expectedLogger}, actualLogger)
}
