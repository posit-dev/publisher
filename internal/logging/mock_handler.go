package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"

	"github.com/stretchr/testify/mock"
)

type MockHandler struct {
	mock.Mock
}

var _ slog.Handler = &MockHandler{}

func NewMockHandler() *MockHandler {
	return &MockHandler{}
}

func (m *MockHandler) Enabled(ctx context.Context, level slog.Level) bool {
	args := m.Called(ctx, level)
	return args.Bool(0)
}

func (m *MockHandler) Handle(ctx context.Context, rec slog.Record) error {
	args := m.Called(ctx, rec)
	return args.Error(0)
}

func (m *MockHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	args := m.Called(attrs)
	return args.Get(0).(slog.Handler)
}

func (m *MockHandler) WithGroup(name string) slog.Handler {
	args := m.Called(name)
	return args.Get(0).(slog.Handler)
}
