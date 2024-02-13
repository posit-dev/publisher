package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"log/slog"

	"github.com/rstudio/connect-client/internal/logging"
)

func NewCLILogger(verbosity int, w io.Writer) logging.Logger {
	level := logLevel(verbosity)
	stderrHandler := slog.NewTextHandler(w, &slog.HandlerOptions{Level: level})
	return logging.FromStdLogger(slog.New(stderrHandler))
}
