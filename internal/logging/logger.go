package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"
)

// Logger is an interface that describes `slog.Logger`
type Logger interface {
	Error(msg string, args ...any)
	Warn(msg string, args ...any)
	Info(msg string, args ...any)
	Debug(msg string, args ...any)
	Log(ctx context.Context, level slog.Level, msg string, args ...any)

	Handler() slog.Handler
	Enabled(ctx context.Context, level slog.Level) bool
	With(args ...any) *slog.Logger
	WithGroup(name string) *slog.Logger
}

var _ Logger = &slog.Logger{}
