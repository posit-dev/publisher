package bundlestest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"path/filepath"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
)

type MockWalker struct {
	mock.Mock
}

func NewMockWalker() *MockWalker {
	return &MockWalker{}
}

func (m *MockWalker) Walk(path string, fn filepath.WalkFunc) error {
	args := m.Called(path, fn)
	return args.Error(0)
}

func (m *MockWalker) FS() afero.Fs {
	args := m.Called()
	fs := args.Get(0)
	if fs == nil {
		return nil
	}
	return fs.(afero.Fs)
}
