// Copyright (C) 2023 by Posit Software, PBC.

package matcher

import (
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockGitIgnoreList struct {
	mock.Mock
}

func (m *MockGitIgnoreList) AddFile(path util.AbsolutePath) error {
	args := m.Called(path)
	return args.Error(0)
}

func (m *MockGitIgnoreList) Match(path util.AbsolutePath) *Pattern {
	args := m.Called(path)
	return args.Get(0).(*Pattern)
}

func (m *MockGitIgnoreList) Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	args := m.Called(root, fn)
	return args.Error(0)
}

var _ IgnoreList = &MockGitIgnoreList{}
