package dcf

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/publishing-client/internal/util"
	"github.com/stretchr/testify/mock"
)

type MockDecoder struct {
	mock.Mock
}

type MockFileReader struct {
	mock.Mock
}

var _ Decoder = &MockDecoder{}
var _ FileReader = &MockFileReader{}

func NewMockDecoder() *MockDecoder {
	return &MockDecoder{}
}

func NewMockFileReader() *MockFileReader {
	return &MockFileReader{}
}

func (m *MockDecoder) Decode(r io.Reader) (Records, error) {
	args := m.Called(r)
	records := args.Get(0)
	if records == nil {
		return nil, args.Error(1)
	} else {
		return records.(Records), args.Error(1)
	}
}

func (m *MockFileReader) ReadFile(path util.Path) (Records, error) {
	args := m.Called(path)
	records := args.Get(0)
	if records == nil {
		return nil, args.Error(1)
	} else {
		return records.(Records), args.Error(1)
	}
}

func (m *MockFileReader) ReadFiles(path util.Path, pattern string) (Records, error) {
	args := m.Called(path, pattern)
	records := args.Get(0)
	if records == nil {
		return nil, args.Error(1)
	} else {
		return records.(Records), args.Error(1)
	}
}
