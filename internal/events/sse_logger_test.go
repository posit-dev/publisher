package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/r3labs/sse/v2"
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
	emitter := NewSSEEmitter(sseServer)
	log := NewLoggerWithSSE(1, emitter)
	s.IsType(log.Handler(), &logging.MultiHandler{})
}
