package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"
	"slices"
)

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
