package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"log/slog"
	"os"

	"github.com/rstudio/connect-client/internal/logging"
)

func NewStructuredLogger(verbosity int) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}

func NewSimpleLogger(verbosity int, w io.Writer) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(w, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}
