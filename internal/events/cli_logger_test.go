package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type CLILoggerSuite struct {
	utiltest.Suite
}

func TestCLILoggerSuite(t *testing.T) {
	suite.Run(t, new(CLILoggerSuite))
}

func (s *CLILoggerSuite) TestNewStructuredLogger() {
	log := NewStructuredLogger(1)
	s.IsType(log.Handler(), &slog.TextHandler{})
	debugEnabled := log.Handler().Enabled(context.Background(), slog.LevelDebug)
	s.False(debugEnabled)
}

func (s *CLILoggerSuite) TestNewStructuredLoggerDebug() {
	log := NewStructuredLogger(2)
	s.IsType(log.Handler(), &slog.TextHandler{})
	debugEnabled := log.Handler().Enabled(context.Background(), slog.LevelDebug)
	s.True(debugEnabled)
}

func (s *LoggerSuite) TestNewSimpleLogger() {
	log := NewSimpleLogger(0, os.Stderr)
	s.IsType(log.Handler(), &logging.MultiHandler{})
}
