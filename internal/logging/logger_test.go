package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"log/slog"
	"testing"

	"github.com/rstudio/publishing-client/internal/logging/loggingtest"
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
	log := New()
	s.NotNil(log.BaseLogger)
}

func (s *LoggingSuite) TestFromStdLogger() {
	stdLogger := slog.Default()
	log := FromStdLogger(stdLogger)
	s.NotNil(log.BaseLogger)
	s.Equal(stdLogger, log.BaseLogger)
}

func (s *LoggingSuite) TestStart() {
	baseLogger := loggingtest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, StartPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Start("message", "arg", "value")
	s.Assert()
}

func (s *LoggingSuite) TestSuccess() {
	baseLogger := loggingtest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, SuccessPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Success("message", "arg", "value")
	s.Assert()
}

func (s *LoggingSuite) TestStatus() {
	baseLogger := loggingtest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, ProgressPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Status("message", "arg", "value")
	s.Assert()
}

func (s *LoggingSuite) TestProgress() {
	baseLogger := loggingtest.NewMockLogger()
	baseLogger.On(
		"Info", "message",
		LogKeyPhase, ProgressPhase,
		"done", float32(20),
		"total", float32(100),
		"arg", "value")

	log := Logger{baseLogger}
	log.Progress("message", 20, 100, "arg", "value")
	s.Assert()
}

func (s *LoggingSuite) TestFailureGoError() {
	baseLogger := loggingtest.NewMockLogger()
	baseLogger.On("Error", "test error", LogKeyPhase, FailurePhase)
	baseLogger.On("Debug", mock.AnythingOfType("string"))

	log := Logger{baseLogger}
	err := errors.New("test error")
	log.Failure(err)
	s.Assert()
}

func (s *LoggingSuite) TestFailureAgentError() {
	baseLogger := loggingtest.NewMockLogger()
	op := types.Operation("testOp")

	baseLogger.On(
		"Error", "test error",
		LogKeyOp, op,
		LogKeyPhase, FailurePhase,
		LogKeyErrCode, types.UnknownErrorCode,
		"Metadata", "some metadata")

	log := Logger{baseLogger}
	baseErr := errors.New("test error")
	errData := struct {
		Metadata string
	}{"some metadata"}
	err := types.NewAgentError(types.UnknownErrorCode, baseErr, &errData)
	err.SetOperation(op)
	log.Failure(err)
	s.Assert()
}

func (s *LoggingSuite) TestWith() {
	baseLogger := loggingtest.NewMockLogger()
	expectedLogger := slog.Default()
	baseLogger.On("With", "arg", "value", "arg2", "value2").Return(expectedLogger)
	log := Logger{baseLogger}
	actualLogger := log.With("arg", "value", "arg2", "value2")
	s.Equal(Logger{expectedLogger}, actualLogger)
}
