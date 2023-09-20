package loggingtest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/publishing-client/internal/logging"
)

type MockLogger struct {
	logging.MockBaseLogger
}

func NewMockLogger() *MockLogger {
	return &MockLogger{}
}

func (m *MockLogger) Start(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Success(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Status(msg string, args ...any) {
	mockArgs := append([]any{msg}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Progress(msg string, done float32, total float32, args ...any) {
	mockArgs := append([]any{msg, done, total}, args...)
	m.Called(mockArgs...)
}

func (m *MockLogger) Failure(err error) {
	m.Called(err)
}

func (m *MockLogger) WithArgs(args ...any) logging.Logger {
	mockArgs := m.Called(args...)
	return mockArgs.Get(0).(logging.Logger)
}
