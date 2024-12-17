package interpreters

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"

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

func (m *MockRInterpreter) GetRExecutable() (util.AbsolutePath, error) {
	args := m.Called()
	arg0 := args.Get(0)
	if arg0 == nil {
		return util.AbsolutePath{}, args.Error(1)
	} else {
		var i interface{} = arg0
		if path, ok := i.(string); ok {
			return util.NewAbsolutePath(path, nil), args.Error(1)
		} else {
			return util.AbsolutePath{}, errors.New("invalid string argument")
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
			return "", errors.New("invalid string argument")
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
		return util.NewRelativePath(path.String(), nil), exists, args.Error(2)
	}
}

func (m *MockRInterpreter) CreateLockfile(lockfilePath util.AbsolutePath) error {
	args := m.Called(lockfilePath)
	return args.Error(0)
}
