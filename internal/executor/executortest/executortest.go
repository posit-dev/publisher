package executortest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockExecutor struct {
	mock.Mock
}

func NewMockExecutor() *MockExecutor {
	return &MockExecutor{}
}

func (m *MockExecutor) RunCommand(executable string, argv []string, cwd util.AbsolutePath, log logging.Logger) ([]byte, []byte, error) {
	args := m.Called(executable, argv, cwd, log)

	var outSlice []byte
	out := args.Get(0)
	if out != nil {
		outSlice = out.([]byte)
	}
	var errSlice []byte
	stderr := args.Get(1)
	if stderr != nil {
		errSlice = stderr.([]byte)
	}
	return outSlice, errSlice, args.Error(2)
}
