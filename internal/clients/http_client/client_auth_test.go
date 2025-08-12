package http_client

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockAuthMethod is a mock implementation of auth.AuthMethod
type MockAuthMethod struct {
	mock.Mock
}

func (m *MockAuthMethod) AddAuthHeaders(req *http.Request) error {
	args := m.Called(req)
	return args.Error(0)
}

func TestAuthenticatedTransport_RoundTrip(t *testing.T) {
	// Create a mock auth method
	mockAuth := new(MockAuthMethod)
	mockAuth.On("AddAuthHeaders", mock.Anything).Return(nil)

	// Create a base round tripper that always succeeds
	baseRoundTripper := RoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       http.NoBody,
		}, nil
	})

	// Create the authenticated transport
	transport := NewAuthenticatedTransport(baseRoundTripper, mockAuth)

	// Create a test request
	req := httptest.NewRequest("GET", "http://example.com/test", nil)

	// Send the request
	resp, err := transport.RoundTrip(req)

	// Verify the result
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	mockAuth.AssertExpectations(t)
}

func TestAuthenticatedTransport_RoundTrip_AuthError(t *testing.T) {
	// Create a mock auth method that fails
	mockAuth := new(MockAuthMethod)
	mockAuth.On("AddAuthHeaders", mock.Anything).Return(errors.New("auth error"))

	// Create a base round tripper
	baseRoundTripper := RoundTripFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatal("Base RoundTripper should not be called when auth fails")
		return nil, nil
	})

	// Create the authenticated transport
	transport := NewAuthenticatedTransport(baseRoundTripper, mockAuth)

	// Create a test request
	req := httptest.NewRequest("GET", "http://example.com/test", nil)

	// Send the request
	resp, err := transport.RoundTrip(req)

	// Verify the result
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "auth error")
	mockAuth.AssertExpectations(t)
}

// RoundTripFunc allows using a function as a RoundTripper
type RoundTripFunc func(req *http.Request) (*http.Response, error)

func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
