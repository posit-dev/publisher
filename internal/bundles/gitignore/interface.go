// Copyright (C) 2023 by Posit Software, PBC.

package gitignore

import (
	"path/filepath"

	"github.com/iriri/minimal/gitignore"
	"github.com/stretchr/testify/mock"
)

type GitIgnoreList interface {
	Append(path string) error
	AppendGlob(s string) error
	AppendGit() error
	Match(path string) bool
	Walk(root string, fn filepath.WalkFunc) error
}

// Ensure that the gitignore object meets the interface
var _ GitIgnoreList = &IgnoreList{}

type MockGitIgnoreList struct {
	mock.Mock
}

func (m *MockGitIgnoreList) Append(path string) error {
	args := m.Called(path)
	return args.Error(0)
}

func (m *MockGitIgnoreList) AppendGlob(s string) error {
	args := m.Called(s)
	return args.Error(0)
}

func (m *MockGitIgnoreList) AppendGit() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockGitIgnoreList) Match(path string) bool {
	args := m.Called(path)
	return args.Bool(0)
}

func (m *MockGitIgnoreList) Walk(root string, fn filepath.WalkFunc) error {
	args := m.Called(root, fn)
	return args.Error(0)
}

// Maintain a reference to the original gitignore so it
// and its license remain in our vendor directory.
type upstreamGitignore gitignore.IgnoreList
