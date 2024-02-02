package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/stretchr/testify/mock"
)

type mockEmitter struct {
	mock.Mock
}

func NewMockEmitter() *mockEmitter {
	return &mockEmitter{}
}

func (m *mockEmitter) Emit(event *Event) error {
	args := m.Called(event)
	return args.Error(0)
}
