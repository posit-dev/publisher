package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockPythonInspector struct {
	mock.Mock
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

func (m *MockPythonInspector) CreateRequirementsFile(base util.Path, dest util.Path) error {
	args := m.Called(base, dest)
	return args.Error(0)
}

func (m *MockPythonInspector) GetRequirements(base util.Path) ([]string, string, error) {
	args := m.Called()
	reqs := args.Get(0)
	if reqs == nil {
		return nil, args.String(1), args.Error(2)
	} else {
		return reqs.([]string), args.String(1), args.Error(2)
	}
}
