package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"
	"testing"

	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type LoggerSuite struct {
	utiltest.Suite
}

func TestLoggerSuite(t *testing.T) {
	suite.Run(t, new(LoggerSuite))
}

func (s *LoggerSuite) TestNewLogger() {
	log := NewLogger(false)
	s.IsType(log.Handler(), &slog.TextHandler{})
	debugEnabled := log.Handler().Enabled(context.Background(), slog.LevelDebug)
	s.False(debugEnabled)
}

func (s *LoggerSuite) TestNewLoggerDebug() {
	log := NewLogger(true)
	s.IsType(log.Handler(), &slog.TextHandler{})
	debugEnabled := log.Handler().Enabled(context.Background(), slog.LevelDebug)
	s.True(debugEnabled)
}

func (s *LoggerSuite) TestNewLoggerWithSSE() {
	log := NewLoggerWithSSE(false)
	s.IsType(log.Handler(), &logging.MultiHandler{})
}
