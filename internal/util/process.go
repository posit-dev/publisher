package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os/exec"

	"github.com/stretchr/testify/mock"
)

type PathLooker interface {
	LookPath(name string) (string, error)
}

type defaultPathLooker struct{}

func NewPathLooker() PathLooker {
	return &defaultPathLooker{}
}

func (p *defaultPathLooker) LookPath(name string) (string, error) {
	return exec.LookPath(name)
}

type mockPathLooker struct {
	mock.Mock
}

func NewMockPathLooker() *mockPathLooker {
	return &mockPathLooker{}
}

func (m *mockPathLooker) LookPath(name string) (string, error) {
	args := m.Called(name)
	return args.String(0), args.Error(1)
}
