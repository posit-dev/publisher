package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockPythonInterpreter struct {
	mock.Mock
}

func NewMockPythonInterpreter() *MockPythonInterpreter {
	return &MockPythonInterpreter{}
}

// We need just the simplest of a mock to start, as most of the
// functionality can be accomplished via setting items within
// the working structure.

func (m *MockPythonInterpreter) Init() error {
	return nil
}

func (m *MockPythonInterpreter) IsPythonExecutableValid() bool {
	args := m.Called()
	arg0 := args.Get(0)
	if arg0 == nil {
		return false
	} else {
		var i interface{} = arg0
		if b, ok := i.(bool); ok {
			return b
		} else {
			return false
		}
	}
}

func (m *MockPythonInterpreter) GetPythonExecutable() (util.AbsolutePath, error) {
	args := m.Called()
	arg0 := args.Get(0)
	if arg0 == nil {
		return util.AbsolutePath{}, args.Error(1)
	} else {
		var i interface{} = arg0
		if path, ok := i.(util.AbsolutePath); ok {
			return path, args.Error(1)
		} else {
			return util.AbsolutePath{}, args.Error(1)
		}
	}
}

func (m *MockPythonInterpreter) GetPythonVersion() (string, error) {
	args := m.Called()
	arg0 := args.Get(0)
	if arg0 == nil {
		return "", args.Error(1)
	} else {
		var i interface{} = arg0
		if version, ok := i.(string); ok {
			return version, args.Error(1)
		} else {
			return "", args.Error(1)
		}
	}
}
