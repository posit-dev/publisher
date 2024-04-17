// Copyright (C) 2023 by Posit Software, PBC.

package matcher

import (
	"github.com/rstudio/connect-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockMatchList struct {
	mock.Mock
}

func (m *MockMatchList) AddFromFile(base util.AbsolutePath, filePath util.AbsolutePath, patterns []string) error {
	args := m.Called(base, filePath, patterns)
	return args.Error(0)
}

func (m *MockMatchList) Match(path util.AbsolutePath) *Pattern {
	args := m.Called(path)
	return args.Get(0).(*Pattern)
}

func (m *MockMatchList) Walk(root util.AbsolutePath, fn util.AbsoluteWalkFunc) error {
	args := m.Called(root, fn)
	return args.Error(0)
}

var _ MatchList = &MockMatchList{}
