package inspect

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"errors"

	"github.com/posit-dev/publisher/internal/config"
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

func (m *MockRInspector) RequiresR(*config.Config) (bool, error) {
	args := m.Called()
	arg0 := args.Get(0)
	if arg0 == nil {
		return false, args.Error(1)
	} else {
		var i interface{} = arg0
		if b, ok := i.(bool); ok {
			return b, args.Error(1)
		} else {
			return false, errors.New("invalid boolean argument")
		}
	}
}
