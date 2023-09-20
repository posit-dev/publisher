package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"log/slog"

	"github.com/stretchr/testify/mock"
)

type MockBaseLogger struct {
	mock.Mock
}

func NewMockBaseLogger() *MockBaseLogger {
	return &MockBaseLogger{}
}

func (m *MockBaseLogger) Error(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockBaseLogger) Warn(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockBaseLogger) Info(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockBaseLogger) Debug(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockBaseLogger) Log(ctx context.Context, level slog.Level, msg string, args ...any) {
	mockArgs := append([]any{ctx, level, msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockBaseLogger) Handler() slog.Handler {
	mockArgs := m.Called()
	return mockArgs.Get(0).(slog.Handler)
}

func (m *MockBaseLogger) Enabled(ctx context.Context, level slog.Level) bool {
	args := m.Called(ctx, level)
	return args.Bool(0)
}

func (m *MockBaseLogger) With(args ...any) *slog.Logger {
	mockArgs := m.Called(args...)
	return mockArgs.Get(0).(*slog.Logger)
}

func (m *MockBaseLogger) WithGroup(name string) *slog.Logger {
	mockArgs := m.Called(name)
	return mockArgs.Get(0).(*slog.Logger)
}
