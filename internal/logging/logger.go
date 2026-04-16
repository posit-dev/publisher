package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"log/slog"
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

func NewDiscardLogger() Logger {
	discardLgr := slog.New(slog.NewJSONHandler(io.Discard, nil))
	return logger{discardLgr}
}
