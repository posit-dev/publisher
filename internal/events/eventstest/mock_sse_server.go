package eventstest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/r3labs/sse/v2"
	"github.com/stretchr/testify/mock"
)

type MockSSEServer struct {
	mock.Mock
}

func NewMockSSEServer() *MockSSEServer {
	return &MockSSEServer{}
}

func (m *MockSSEServer) Close() {
	m.Called()
}

func (m *MockSSEServer) CreateStream(id string) *sse.Stream {
	args := m.Called(id)
	return args.Get(0).(*sse.Stream)
}

func (m *MockSSEServer) RemoveStream(id string) {
	m.Called(id)
}

func (m *MockSSEServer) StreamExists(id string) bool {
	args := m.Called(id)
	return args.Bool(0)
}

func (m *MockSSEServer) Publish(id string, event *sse.Event) {
	m.Called(id, event)
}

func (m *MockSSEServer) TryPublish(id string, event *sse.Event) bool {
	args := m.Called(id, event)
	return args.Bool(0)
}
