package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"log/slog"

	"github.com/posit-dev/publisher/internal/logging"
)

func logLevel(verbosity int) slog.Level {
	switch verbosity {
	case 0:
		return slog.LevelWarn
	case 1:
		return slog.LevelInfo
	}
	return slog.LevelDebug
}

func NewCLILogger(verbosity int, w io.Writer) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(w, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}
