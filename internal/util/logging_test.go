package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
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

func (s *LoggingSuite) TestNewLoggerWriter() {
	logger := slog.Default()
	writer := NewLoggerWriter(logger)
	s.Equal(logger, writer.logger)
}

func (s *LoggingSuite) TestWrite() {
	var w bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&w, nil))
	writer := NewLoggerWriter(logger)
	_, err := writer.Write([]byte("this is a line of output\n"))
	s.Nil(err)
	_, err = writer.Write([]byte("this is another line\n"))
	s.Nil(err)
	out := w.String()
	s.Contains(out, "this is a line of output")
	s.Contains(out, "this is another line")
}
