package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
)

// Special attribute keys for use in logging.
// LogKeyOp should be followed by an Operation,
// and LogKeyPhase should be followed by a Phase.
const (
	LogKeyOp      = "event_op"
	LogKeyErrCode = "error_code"
)

type Logger interface {
	BaseLogger
	WithArgs(args ...any) Logger
}

type logger struct {
	BaseLogger
}

func New() Logger {
	return logger{
		slog.Default(),
	}
}

func FromStdLogger(log *slog.Logger) Logger {
	return logger{log}
}

func (l logger) WithArgs(args ...any) Logger {
	return logger{l.BaseLogger.With(args...)}
}
