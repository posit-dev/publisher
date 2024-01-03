package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"context"
	"errors"
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

func (s *LoggerSuite) TestHandleStart() {
	w := utiltest.NewMockWriter()
	expected := []byte("Prepare Files...                   ")
	w.On("Write", expected).Return(len(expected), nil)
	h := NewCLIHandler(newStructuredLogWriter(w))

	log := logging.FromStdLogger(slog.New(h))
	log = log.WithArgs(logging.LogKeyOp, PublishCreateBundleOp)
	log.Start("Creating bundle")
}

func (s *LoggerSuite) TestHandleSuccess() {
	w := utiltest.NewMockWriter()
	expected := []byte("[OK]\n")
	w.On("Write", expected).Return(len(expected), nil)
	h := NewCLIHandler(newStructuredLogWriter(w))

	log := logging.FromStdLogger(slog.New(h))
	log = log.WithArgs(logging.LogKeyOp, PublishCreateBundleOp)
	log.Success("Done", "filename", "/tmp/bundle-1.tar.gz")
}

func (s *LoggerSuite) TestHandleFailure() {
	w := utiltest.NewMockWriter()
	expected := []byte("[ERROR]\n")
	w.On("Write", expected).Return(len(expected), nil)
	h := NewCLIHandler(newStructuredLogWriter(w))

	log := logging.FromStdLogger(slog.New(h))
	log = log.WithArgs(logging.LogKeyOp, PublishCreateBundleOp)
	log.Failure(errors.New("test error"))
}

func (s *LoggerSuite) TestHandleOtherOp() {
	// The handler won't write anything
	h := NewCLIHandler(nil)
	log := logging.FromStdLogger(slog.New(h))
	log = log.WithArgs(logging.LogKeyOp, PublishOp)
	log.Start("Publishing")
}

func (s *LoggerSuite) TestHandleNewLine() {
	w := new(bytes.Buffer)
	log := NewSimpleLogger(0, w)
	log = log.WithArgs(logging.LogKeyOp, PublishCreateBundleOp)
	log.Start("Creating bundle")
	log.Error("test error")
	log.Failure(errors.New("Failed!"))
	str := w.String()
	s.Contains(str, "Prepare Files...                   \ntime=")
}
