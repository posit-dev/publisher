package inspect

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockRInspector struct {
	mock.Mock
}

func NewMockRInspector() *MockRInspector {
	return &MockRInspector{}
}

func (m *MockRInspector) InspectR() (*config.R, error) {
	args := m.Called()
	cfg := args.Get(0)
	if cfg == nil {
		return nil, args.Error(1)
	} else {
		return cfg.(*config.R), args.Error(1)
	}
}

func (m *MockRInspector) CreateLockfile(lockfilePath util.AbsolutePath) error {
	args := m.Called(lockfilePath)
	return args.Error(0)
}
