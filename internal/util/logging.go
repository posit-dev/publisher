package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"
	"slices"
)

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

type MultiHandler struct {
	handlers []slog.Handler
}

func NewMultiHandler(handlers ...slog.Handler) slog.Handler {
	return &MultiHandler{
		handlers: handlers,
	}
}

func (m *MultiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *MultiHandler) Handle(ctx context.Context, rec slog.Record) error {
	for _, h := range m.handlers {
		// Check level, since Handle should only be called
		// when the handler is enabled for this level.
		// See the slog.Handler interface docs.
		if h.Enabled(ctx, rec.Level) {
			err := h.Handle(ctx, rec)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *MultiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, 0, len(m.handlers))
	for _, h := range m.handlers {
		// Copy the attributes for each handler, because
		// each handler is allowed to assume that it owns the slice.
		// See the slog.Handler interface docs.
		handlers = append(handlers, h.WithAttrs(slices.Clip(attrs)))
	}
	return NewMultiHandler(handlers...)
}

func (m *MultiHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		// If the name is empty, WithGroup returns the receiver.
		// See the slog.Handler interface docs.
		return m
	}
	handlers := make([]slog.Handler, 0, len(m.handlers))
	for _, h := range m.handlers {
		handlers = append(handlers, h.WithGroup(name))
	}
	return NewMultiHandler(handlers...)
}
