// Copyright (C) 2023 by Posit Software, PBC.

package gitignore

import (
	"github.com/iriri/minimal/gitignore"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type IgnoreList interface {
	Append(path util.Path) error
	AppendGlobs(patterns []string, source MatchSource) error
	AppendGit() error
	Match(path string) *Match
	Walk(root util.Path, fn util.WalkFunc) error
}

// Ensure that the gitignore object meets the interface
var _ IgnoreList = &GitIgnoreList{}

type MockGitIgnoreList struct {
	mock.Mock
}

func (m *MockGitIgnoreList) Append(path util.Path) error {
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

func (m *MockGitIgnoreList) Match(path string) bool {
	args := m.Called(path)
	return args.Bool(0)
}

func (m *MockGitIgnoreList) Walk(root util.Path, fn util.WalkFunc) error {
	args := m.Called(root, fn)
	return args.Error(0)
}

// Maintain a reference to the original gitignore so it
// and its license remain in our vendor directory.
type _ gitignore.IgnoreList
