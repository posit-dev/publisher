package utiltest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"

	"github.com/stretchr/testify/mock"
)

type MockTarWriter struct {
	mock.Mock
}

func NewMockTarWriter() *MockTarWriter {
	return &MockTarWriter{}
}

func (m *MockTarWriter) WriteHeader(hdr *tar.Header) error {
	args := m.Called(hdr)
	return args.Error(0)
}

func (m *MockTarWriter) Write(p []byte) (int, error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockTarWriter) Close() error {
	args := m.Called()
	return args.Error(0)
}
