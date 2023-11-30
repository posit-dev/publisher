package environmenttest

// Copyright (C) 2023 by Posit Software, PBC.

import "github.com/stretchr/testify/mock"

type MockPythonInspector struct {
	mock.Mock
}

func (m *MockPythonInspector) GetPythonVersion() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
}

func (m *MockPythonInspector) EnsurePythonRequirementsFile() error {
	args := m.Called()
	return args.Error(0)
}
