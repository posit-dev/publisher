package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"os"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/publishing-client/internal/logging"
)

func logLevel(debug bool) slog.Level {
	if debug {
		return slog.LevelDebug
	} else {
		return slog.LevelInfo
	}
}

func NewLogger(debug bool) logging.Logger {
	level := logLevel(debug)
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}

func NewLoggerWithSSE(debug bool) logging.Logger {
	level := logLevel(debug)
	eventServer := sse.New()
	eventServer.CreateStream("messages")
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	sseHandler := NewSSEHandler(eventServer, &SSEHandlerOptions{Level: level})
	multiHandler := logging.NewMultiHandler(stderrHandler, sseHandler)
	return logging.FromStdLogger(slog.New(multiHandler))
}
