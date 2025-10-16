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

func TestPostConnectTokenHandlerWithExtraPaths(t *testing.T) {
	// Test that URL discovery works with extra paths in the server URL
	// This mirrors TestPostTestCredentialsHandlerFuncWithExtraPaths for API key auth

	logger := loggingtest.NewMockLogger()
	logger.On("Enabled", mock.Anything, mock.Anything).Return(false)
	logger.On("Error", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
	logger.On("Info", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()

	// Track which URLs are called
	callCount := 0
	var serverURL string

	// Create a mock Connect server that responds to token creation
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		if r.URL.Path == "/__api__/tokens" ||
		   r.URL.Path == "/pass/__api__/tokens" ||
		   r.URL.Path == "/pass/fail/__api__/tokens" ||
		   r.URL.Path == "/pass/fail/fail/__api__/tokens" {
			callCount++

			// Fail the first two requests (longest paths), succeed on the third
			if callCount <= 2 {
				w.WriteHeader(http.StatusNotFound)
				return
			}

			// Third request succeeds - return a valid token response
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token_claim_url": serverURL + "/connect/#/claim/abc123",
			})
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mockServer.Close()
	serverURL = mockServer.URL

	handler := PostConnectTokenHandlerFunc(logger)

	// Create request with extra paths that will be stripped during discovery
	// Format: base/path1/path2/path3?query=param
	requestBody, err := json.Marshal(PostConnectTokenRequest{
		ServerURL: mockServer.URL + "/pass/fail/fail?abc=123",
	})
	assert.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/connect/token", bytes.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	handler(recorder, req)

	// Should succeed with URL discovery
	assert.Equal(t, http.StatusCreated, recorder.Code)

	var response PostConnectTokenResponse
	err = json.Unmarshal(recorder.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify the response includes the discovered URL (without the extra paths)
	assert.Equal(t, mockServer.URL+"/pass", response.ServerURL)
	assert.NotEmpty(t, response.Token)
	assert.NotEmpty(t, response.ClaimURL)
	assert.NotEmpty(t, response.PrivateKey)

	// Verify we made 3 attempts (fail, fail, succeed)
	assert.Equal(t, 3, callCount)
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
