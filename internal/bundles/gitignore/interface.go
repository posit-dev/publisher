// Copyright (C) 2023 by Posit Software, PBC.

package gitignore

import (
	"github.com/iriri/minimal/gitignore"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type IgnoreList interface {
	Append(path util.AbsolutePath) error
	AppendGlobs(patterns []string, source MatchSource) error
	AppendGit() error
	Match(path string) (*Match, error)
	Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error
}

// Ensure that the gitignore object meets the interface
var _ IgnoreList = &GitIgnoreList{}

type MockGitIgnoreList struct {
	mock.Mock
}

func (m *MockGitIgnoreList) Append(path util.AbsolutePath) error {
	args := m.Called(path)
	return args.Error(0)
}

func (m *MockGitIgnoreList) AppendGlobs(patterns []string, source MatchSource) error {
	args := m.Called(patterns, source)
	return args.Error(0)
}

func (m *MockGitIgnoreList) AppendGit() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockGitIgnoreList) Match(path string) (*Match, error) {
	args := m.Called(path)
	return args.Get(0).(*Match), args.Error(1)
}

func (m *MockGitIgnoreList) Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	args := m.Called(root, fn)
	return args.Error(0)
}

var _ IgnoreList = &MockGitIgnoreList{}

// Maintain a reference to the original gitignore so it
// and its license remain in our vendor directory.
type _ gitignore.IgnoreList
