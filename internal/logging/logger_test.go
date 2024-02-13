package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
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

func (s *LoggingSuite) TestWith() {
	baseLogger := NewMockBaseLogger()
	expectedLogger := slog.Default()
	baseLogger.On("With", "arg", "value", "arg2", "value2").Return(expectedLogger)
	log := logger{baseLogger}
	actualLogger := log.WithArgs("arg", "value", "arg2", "value2")
	s.Equal(logger{expectedLogger}, actualLogger)
}
