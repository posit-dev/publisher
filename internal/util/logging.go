package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"strings"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// LoggerWriter is an adapter that provides an
// io.Writer interface to rslog.Logger.
type LoggerWriter struct {
	logger rslog.Logger
}

func NewLoggerWriter(logger rslog.Logger) io.Writer {
	return &LoggerWriter{
		logger: logger,
	}
}

func (w *LoggerWriter) Write(data []byte) (int, error) {
	w.logger.Infof("%s", strings.TrimRight(string(data), "\n"))
	return len(data), nil
}
