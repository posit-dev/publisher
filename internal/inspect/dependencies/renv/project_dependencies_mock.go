package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockRDependencyScanner struct {
	mock.Mock
}

func NewMockRDependencyScanner() *MockRDependencyScanner {
	return &MockRDependencyScanner{}
}

func (m *MockRDependencyScanner) ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error) {
	args := m.Called(paths, rExecutable)
	result := args.Get(0)
	if result == nil {
		return util.AbsolutePath{}, args.Error(1)
	}
	return result.(util.AbsolutePath), args.Error(1)
}

func (m *MockRDependencyScanner) SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	args := m.Called(targetPath, lockfile, rExecutable)
	result := args.Get(0)
	if result == nil {
		return util.AbsolutePath{}, args.Error(1)
	}
	return result.(util.AbsolutePath), args.Error(1)
}
