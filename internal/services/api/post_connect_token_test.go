package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestPostConnectTokenHandler(t *testing.T) {
	// This test is minimal because we can't easily mock the Connect server interaction
	// We'll just verify that the handler correctly parses the request and returns a response

	logger := loggingtest.NewMockLogger()
	// Set expectation for the Enabled method which is called by the HTTP client
	logger.On("Enabled", mock.Anything, mock.Anything).Return(false)
	// Mock the Error method which is called when there's an error during the HTTP request
	logger.On("Error", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	handler := PostConnectTokenHandlerFunc(logger)

	// Create request body
	requestBody, err := json.Marshal(PostConnectTokenRequest{
		ServerURL: "https://example.com",
	})
	assert.NoError(t, err)

	// Create HTTP request
	req := httptest.NewRequest("POST", "/api/connect/token", bytes.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	recorder := httptest.NewRecorder()

	// Call handler - note this will fail since we're not mocking the Connect client
	// But we can test the error handling
	handler(recorder, req)

	// Expect an internal server error since we can't connect to the example.com server
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
}

func TestPostConnectTokenUserHandler(t *testing.T) {
	// This test is minimal because we can't easily mock the Connect server interaction
	// We'll just verify that the handler correctly parses the request and returns a response

	logger := loggingtest.NewMockLogger()
	// Set expectation for the Enabled method which is called by the HTTP client
	logger.On("Enabled", mock.Anything, mock.Anything).Return(false)
	// Mock the Error method which is called when there's an error during the HTTP request
	logger.On("Error", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	// Mock the Debug method which is called during token verification
	logger.On("Debug", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	handler := PostConnectTokenUserHandlerFunc(logger)

	// Create request body
	requestBody, err := json.Marshal(struct {
		ServerURL  string `json:"serverUrl"`
		Token      string `json:"token"`
		PrivateKey string `json:"privateKey"`
	}{
		ServerURL:  "https://example.com",
		Token:      "T12345abcdef",
		PrivateKey: "base64-encoded-private-key",
	})
	assert.NoError(t, err)

	// Create HTTP request
	req := httptest.NewRequest("POST", "/api/connect/token/user", bytes.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	// Create response recorder
	recorder := httptest.NewRecorder()

	// Call handler - note this will fail since we're not mocking the Connect client
	// But we can test the error handling
	handler(recorder, req)

	// Expect an internal server error since we can't connect to the example.com server
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
}
