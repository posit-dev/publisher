package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockDependencyScanner struct {
	mock.Mock
}

func NewMockDependencyScanner() *MockDependencyScanner {
	return &MockDependencyScanner{}
}

func (m *MockDependencyScanner) ScanDependencies(base util.Path, pythonExecutable string) ([]*PackageSpec, error) {
	args := m.Called(base, pythonExecutable)
	specs := args.Get(0)
	if specs == nil {
		return nil, args.Error(1)
	} else {
		return specs.([]*PackageSpec), args.Error(1)
	}
}
