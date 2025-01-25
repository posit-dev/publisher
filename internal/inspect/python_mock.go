package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockPythonInspector struct {
	mock.Mock
	pythonInterpreter interpreters.PythonInterpreter
}

func NewMockPythonInspector() *MockPythonInspector {
	return &MockPythonInspector{}
}

func (m *MockPythonInspector) InspectPython() (*config.Python, error) {
	args := m.Called()
	cfg := args.Get(0)
	if cfg == nil {
		return nil, args.Error(1)
	} else {
		return cfg.(*config.Python), args.Error(1)
	}
}

func (m *MockPythonInspector) RequiresPython(cfg *config.Config) (bool, error) {
	args := m.Called(cfg)
	reqs := args.Get(0)
	if reqs == nil {
		return false, args.Error(1)
	} else {
		return reqs.(bool), args.Error(1)
	}
}

func (m *MockPythonInspector) ScanRequirements(base util.AbsolutePath) ([]string, []string, string, error) {
	args := m.Called()

	reqs := args.Get(0)
	var reqsStrings []string
	if reqs != nil {
		reqsStrings = reqs.([]string)
	}

	incomplete := args.Get(1)
	var incompleteStrings []string
	if incomplete != nil {
		incompleteStrings = incomplete.([]string)
	}
	return reqsStrings, incompleteStrings, args.String(2), args.Error(3)
}

func (m *MockPythonInspector) GetPythonInterpreter() interpreters.PythonInterpreter {
	args := m.Called()
	reqs := args.Get(0)
	return reqs.(interpreters.PythonInterpreter)
}
