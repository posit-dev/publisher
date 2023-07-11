package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"
)

type LoggingSuite struct {
	utiltest.Suite
}

func TestLoggingSuite(t *testing.T) {
	suite.Run(t, new(LoggingSuite))
}

func (s *LoggingSuite) TestNewLoggerWriter() {
	logger := rslog.NewDiscardingLogger()
	writer := NewLoggerWriter(logger)
	s.Equal(logger, writer.logger)
}

func (s *LoggingSuite) TestWrite() {
	logger := rslog.NewCapturingLogger(rslog.CapturingLoggerOptions{})
	writer := NewLoggerWriter(logger)
	_, err := writer.Write([]byte("this is a line of output\n"))
	s.Nil(err)
	_, err = writer.Write([]byte("this is another line\n"))
	s.Nil(err)
	expected := []string{
		"this is a line of output",
		"this is another line",
	}
	s.Equal(expected, logger.Messages())
}
