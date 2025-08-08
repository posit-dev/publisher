package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"crypto/md5"
	"encoding/base64"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/api_client/auth/tokenutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// isBase64 tests if a string is base64 encoded
func isBase64(s string) bool {
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}
func TestNewTokenAuthenticator(t *testing.T) {
	// Generate a token for testing
	tokenID, _, privateKey, err := tokenutil.GenerateToken()
	require.NoError(t, err)

	// Valid token and private key should create a token authenticator
	auth, err := NewTokenAuthenticator(tokenID, privateKey)
	assert.NoError(t, err)
	assert.NotNil(t, auth)

	// Invalid private key should return an error
	auth, err = NewTokenAuthenticator(tokenID, "invalid-key")
	assert.Error(t, err)
	assert.Nil(t, auth)

	// Empty token should still create an authenticator (error happens at request time)
	auth, err = NewTokenAuthenticator("", privateKey)
	assert.NoError(t, err)
	assert.NotNil(t, auth)
}

func TestTokenAuthenticatorAddAuthHeaders(t *testing.T) {
	// Generate a token for testing
	tokenID, _, privateKey, err := tokenutil.GenerateToken()
	require.NoError(t, err)

	auth, err := NewTokenAuthenticator(tokenID, privateKey)
	require.NoError(t, err)

	// Create a test request
	req, err := http.NewRequest("GET", "https://example.com/api/v1/resource", nil)
	require.NoError(t, err)

	// Add auth headers
	err = auth.AddAuthHeaders(req)
	assert.NoError(t, err)

	// Check that the required headers are set
	assert.Equal(t, tokenID, req.Header.Get("X-Auth-Token"))
	assert.NotEmpty(t, req.Header.Get("X-Auth-Signature"))
	assert.NotEmpty(t, req.Header.Get("Date"))

	// For a nil body, the checksum should be the base64 encoded MD5 hash of an empty string
	assert.Equal(t, "1B2M2Y8AsgTpgAmY7PhCfg==", req.Header.Get("X-Content-Checksum"))

	// Simple test for signature format (should be base64 encoded)
	signature := req.Header.Get("X-Auth-Signature")
	assert.True(t, isBase64(signature), "Signature should be base64 encoded")
}

func TestTokenAuthenticatorWithRequestBody(t *testing.T) {
	// Generate a token for testing
	tokenID, _, privateKey, err := tokenutil.GenerateToken()
	require.NoError(t, err)

	auth, err := NewTokenAuthenticator(tokenID, privateKey)
	require.NoError(t, err)

	// Test data for the request body
	testBody := `{"test": "data", "foo": "bar"}`

	// Create a test request with a body
	req, err := http.NewRequest("POST", "https://example.com/api/v1/resource",
		strings.NewReader(testBody))
	require.NoError(t, err)
	req.ContentLength = int64(len(testBody))

	// Add auth headers
	err = auth.AddAuthHeaders(req)
	assert.NoError(t, err)

	// Calculate the expected MD5 checksum for verification
	md5Sum := md5.Sum([]byte(testBody))
	expectedChecksum := base64.StdEncoding.EncodeToString(md5Sum[:])

	// Verify that the correct checksum was added to the headers
	assert.Equal(t, expectedChecksum, req.Header.Get("X-Content-Checksum"))

	// Verify that the request body is still readable after checksum calculation
	bodyBytes, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	assert.Equal(t, testBody, string(bodyBytes))
}

func TestSignRequest(t *testing.T) {
	// Generate a token and key pair
	_, _, privateKey, err := tokenutil.GenerateToken()
	require.NoError(t, err)

	// Sign a canonical request
	canonicalRequest := "GET\n/path\nThu, 01 Jan 2023 12:00:00 GMT\n"
	signature, err := signRequest(canonicalRequest, privateKey)
	require.NoError(t, err)

	// Verify the signature is not empty and is base64 encoded
	assert.NotEmpty(t, signature)
	assert.True(t, isBase64(signature), "Signature should be base64 encoded")

	// Different canonical requests should produce different signatures
	canonicalRequest2 := "POST\n/path\nThu, 01 Jan 2023 12:00:00 GMT\n"
	signature2, err := signRequest(canonicalRequest2, privateKey)
	require.NoError(t, err)
	assert.NotEqual(t, signature, signature2)

	// Invalid private key should fail
	_, err = signRequest(canonicalRequest, "invalid-key")
	assert.Error(t, err)
}
