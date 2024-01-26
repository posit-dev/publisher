package utiltest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/stretchr/testify/mock"
)

type MockExecutor struct {
	mock.Mock
}

func NewMockExecutor() *MockExecutor {
	return &MockExecutor{}
}

func (m *MockExecutor) RunCommand(executable string, argv []string, log logging.Logger) ([]byte, error) {
	args := m.Called(executable, argv, log)
	out := args.Get(0)
	if out == nil {
		return nil, args.Error(1)
	} else {
		return out.([]byte), args.Error(1)
	}
}
