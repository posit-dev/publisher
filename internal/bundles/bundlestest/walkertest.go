package bundlestest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/publishing-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockWalker struct {
	mock.Mock
}

func NewMockWalker() *MockWalker {
	return &MockWalker{}
}

func (m *MockWalker) Walk(path util.Path, fn util.WalkFunc) error {
	args := m.Called(path, fn)
	return args.Error(0)
}
