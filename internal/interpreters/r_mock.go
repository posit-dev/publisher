package interpreters

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockRInterpreter struct {
	mock.Mock
}

func NewMockRInterpreter() *MockRInterpreter {
	return &MockRInterpreter{}
}

// We need just the simplest of a mock to start, as most of the
// functionality can be accomplished via setting items within
// the working structure.

func (m *MockRInterpreter) Init() error {
	return nil
}

func (m *MockRInterpreter) IsRExecutableValid() bool {
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

func (m *MockRInterpreter) GetRExecutable() (util.AbsolutePath, error) {
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

func (m *MockRInterpreter) GetRVersion() (string, error) {
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

func (m *MockRInterpreter) GetLockFilePath() (util.RelativePath, bool, error) {
	args := m.Called()
	arg0 := args.Get(0)
	arg1 := args.Get(1)
	if arg0 == nil {
		return util.RelativePath{}, false, args.Error(2)
	} else {
		var iPath interface{} = arg0
		path, ok := iPath.(util.RelativePath)
		if !ok {
			path = util.RelativePath{}
		}
		var iExists interface{} = arg1
		exists, ok := iExists.(bool)
		if !ok {
			exists = false
		}
		return path, exists, args.Error(2)
	}
}

func (m *MockRInterpreter) CreateLockfile(lockfilePath util.AbsolutePath, scanDependencies bool) error {
	args := m.Called(lockfilePath, scanDependencies)
	return args.Error(0)
}

func (m *MockRInterpreter) RenvEnvironmentErrorCheck() *types.AgentError {
	args := m.Called()
	return args.Error(0).(*types.AgentError)
}

func (m *MockRInterpreter) GetPackageManager() string {
	args := m.Called()
	arg0 := args.Get(0)
	return arg0.(string)
}

func (m *MockRInterpreter) GetPreferredPath() string {
	args := m.Called()
	arg0 := args.Get(0)
	return arg0.(string)
}

func (m *MockRInterpreter) GetRRequires() string {
	args := m.Called()
	arg0 := args.Get(0)
	return arg0.(string)
}
