package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"os"

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

func NewLoggerWithSSE(verbosity int, emitter *SSEEmitter) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})

	sseHandler := NewSSEHandler(emitter)
	multiHandler := logging.NewMultiHandler(stderrHandler, sseHandler)
	return logging.FromStdLogger(slog.New(multiHandler))
}
