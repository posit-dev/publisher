package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"os"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/logging"
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

func NewLoggerWithSSE(verbosity int, eventServer *sse.Server) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	sseHandler := NewSSEHandler(eventServer, &SSEHandlerOptions{Level: slog.LevelDebug})
	multiHandler := logging.NewMultiHandler(stderrHandler, sseHandler)
	return logging.FromStdLogger(slog.New(multiHandler))
}
