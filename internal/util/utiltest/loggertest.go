package utiltest

import (
	"context"
	"log/slog"

	"github.com/stretchr/testify/mock"
)

type MockLogger struct {
	mock.Mock
}

func NewMockLogger() *MockLogger {
	return &MockLogger{}
}

func (m *MockLogger) Error(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Warn(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Info(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Debug(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Log(ctx context.Context, level slog.Level, msg string, args ...any) {
	mockArgs := append([]any{ctx, level, msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Handler() slog.Handler {
	mockArgs := m.Called()
	return mockArgs.Get(0).(slog.Handler)
}

func (m *MockLogger) Enabled(ctx context.Context, level slog.Level) bool {
	args := m.Called(ctx, level)
	return args.Bool(0)
}

func (m *MockLogger) With(args ...any) *slog.Logger {
	mockArgs := m.Called(args...)
	return mockArgs.Get(0).(*slog.Logger)
}

func (m *MockLogger) WithGroup(name string) *slog.Logger {
	mockArgs := m.Called(name)
	return mockArgs.Get(0).(*slog.Logger)
}
