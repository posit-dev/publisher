package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"testing"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type LoggerSuite struct {
	utiltest.Suite
}

func TestLoggerSuite(t *testing.T) {
	suite.Run(t, new(LoggerSuite))
}

func (s *LoggerSuite) TestNewLoggerNoSSE() {
	log := NewLoggerWithSSE(slog.LevelInfo, nil)
	s.IsType(log.Handler(), &slog.TextHandler{})
}

func (s *LoggerSuite) TestNewLoggerWithSSE() {
	log := NewLoggerWithSSE(slog.LevelInfo, sse.New())
	s.IsType(log.Handler(), &logging.MultiHandler{})
}
