package utiltest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/stretchr/testify/mock"
)

type MockReader struct {
	mock.Mock
}

type MockWriter struct {
	mock.Mock
}

func NewMockReader() *MockReader {
	return &MockReader{}
}

func NewMockWriter() *MockWriter {
	return &MockWriter{}
}

var _ io.Reader = &MockReader{}
var _ io.Writer = &MockWriter{}

func (m *MockReader) Read(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}

func (m *MockWriter) Write(p []byte) (n int, err error) {
	args := m.Called(p)
	return args.Int(0), args.Error(1)
}
