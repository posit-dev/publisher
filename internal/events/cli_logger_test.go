package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"os"
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type CLILoggerSuite struct {
	utiltest.Suite
}

func TestCLILoggerSuite(t *testing.T) {
	suite.Run(t, new(CLILoggerSuite))
}

func (s *LoggerSuite) TestNewCLILogger() {
	log := NewCLILogger(0, os.Stderr)
	s.IsType(log.Handler(), &slog.TextHandler{})
}
