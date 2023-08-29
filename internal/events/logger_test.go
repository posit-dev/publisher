package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"log/slog"
	"testing"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type LoggerSuite struct {
	utiltest.Suite
}

func TestLoggerSuite(t *testing.T) {
	suite.Run(t, new(LoggerSuite))
}

func (s *LoggerSuite) TestDefaultLogger() {
	log := DefaultLogger()
	s.NotNil(log.Logger)
}

func (s *LoggerSuite) TestNewLoggerNoSSE() {
	log := NewLogger(slog.LevelInfo, nil)
	s.IsType(log.Handler(), &slog.TextHandler{})
}

func (s *LoggerSuite) TestNewLoggerWithSSE() {
	log := NewLogger(slog.LevelInfo, sse.New())
	s.IsType(log.Handler(), &util.MultiHandler{})
}

func (s *LoggerSuite) TestStart() {
	baseLogger := utiltest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, StartPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Start("message", "arg", "value")
	s.Assert()
}

func (s *LoggerSuite) TestSuccess() {
	baseLogger := utiltest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, SuccessPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Success("message", "arg", "value")
	s.Assert()
}

func (s *LoggerSuite) TestStatus() {
	baseLogger := utiltest.NewMockLogger()
	baseLogger.On("Info", "message", LogKeyPhase, ProgressPhase, "arg", "value")

	log := Logger{baseLogger}
	log.Status("message", "arg", "value")
	s.Assert()
}

func (s *LoggerSuite) TestProgress() {
	baseLogger := utiltest.NewMockLogger()
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

func (s *LoggerSuite) TestFailureGoError() {
	baseLogger := utiltest.NewMockLogger()
	baseLogger.On("Error", "test error", LogKeyPhase, FailurePhase)
	baseLogger.On("Debug", mock.AnythingOfType("string"))

	log := Logger{baseLogger}
	err := errors.New("test error")
	log.Failure(err)
	s.Assert()
}

func (s *LoggerSuite) TestFailureAgentError() {
	baseLogger := utiltest.NewMockLogger()
	baseLogger.On(
		"Error", "test error",
		LogKeyOp, PublishDeployBundleOp,
		LogKeyPhase, FailurePhase)

	log := Logger{baseLogger}
	baseErr := errors.New("test error")
	err := NewAgentError(UnknownErrorCode, baseErr, nil)
	err.SetOperation(PublishDeployBundleOp)
	log.Failure(err)
	s.Assert()
}

func (s *LoggerSuite) TestWith() {
	baseLogger := utiltest.NewMockLogger()
	expectedLogger := slog.Default()
	baseLogger.On("With", "arg", "value", "arg2", "value2").Return(expectedLogger)
	log := Logger{baseLogger}
	actualLogger := log.With("arg", "value", "arg2", "value2")
	s.Equal(Logger{expectedLogger}, actualLogger)
}
