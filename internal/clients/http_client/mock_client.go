package http_client

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/stretchr/testify/mock"
)

type MockHTTPClient struct {
	mock.Mock
}

func (m *MockHTTPClient) GetRaw(path string) ([]byte, error) {
	args := m.Called(path)
	data := args.Get(0)
	if data == nil {
		return nil, args.Error(1)
	} else {
		return data.([]byte), args.Error(1)
	}
}

func (m *MockHTTPClient) PostRaw(path string, body io.Reader, bodyType string) ([]byte, error) {
	args := m.Called(path, body, bodyType)
	data := args.Get(0)
	if data == nil {
		return nil, args.Error(1)
	} else {
		return data.([]byte), args.Error(1)
	}
}

func (m *MockHTTPClient) Get(path string, into any) error {
	args := m.Called(path, into)
	return args.Error(0)
}

func (m *MockHTTPClient) Post(path string, body any, into any) error {
	args := m.Called(path, body, into)
	return args.Error(0)
}

func (m *MockHTTPClient) Put(path string, body any, into any) error {
	args := m.Called(path, body, into)
	return args.Error(0)
}

func (m *MockHTTPClient) Patch(path string, body any, into any) error {
	args := m.Called(path, body, into)
	return args.Error(0)
}

func (m *MockHTTPClient) Delete(path string) error {
	args := m.Called(path)
	return args.Error(0)
}
