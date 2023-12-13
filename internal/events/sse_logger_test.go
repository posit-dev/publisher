package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
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

func (s *LoggerSuite) TestNewLoggerWithSSE() {
	sseServer := sse.New()
	log := NewLoggerWithSSE(1, sseServer)
	s.IsType(log.Handler(), &logging.MultiHandler{})
}
