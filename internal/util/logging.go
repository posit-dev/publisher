package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"log/slog"
	"strings"
)

// LoggerWriter is an adapter that provides an
// io.Writer interface to *slog.Logger.
type LoggerWriter struct {
	logger *slog.Logger
}

func NewLoggerWriter(logger *slog.Logger) *LoggerWriter {
	return &LoggerWriter{
		logger: logger,
	}
}

var _ io.Writer = &LoggerWriter{}

func (w *LoggerWriter) Write(data []byte) (int, error) {
	w.logger.Info(strings.TrimRight(string(data), "\n"))
	return len(data), nil
}
