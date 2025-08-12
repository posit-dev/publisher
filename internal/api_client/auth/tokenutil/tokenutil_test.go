package tokenutil

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateToken(t *testing.T) {
	tokenID, publicKey, privateKey, err := GenerateToken()
	assert.NoError(t, err)

	// Check token format (starts with "T" followed by 32 hex characters)
	assert.True(t, strings.HasPrefix(tokenID, "T"))
	assert.Equal(t, 33, len(tokenID)) // "T" + 32 hex characters

	// Check that keys are not empty and properly base64 encoded
	assert.NotEmpty(t, publicKey)
	assert.NotEmpty(t, privateKey)

	// Verify that we can parse the private key
	key, err := ParsePrivateKey(privateKey)
	assert.NoError(t, err)
	assert.NotNil(t, key)

	// Verify that the key is 2048 bits
	assert.Equal(t, 2048, key.N.BitLen())
}

func TestGenerateMultipleTokens(t *testing.T) {
	// Generate two tokens and make sure they're different
	token1, pub1, priv1, err1 := GenerateToken()
	assert.NoError(t, err1)

	token2, pub2, priv2, err2 := GenerateToken()
	assert.NoError(t, err2)

	// All parts should be different
	assert.NotEqual(t, token1, token2)
	assert.NotEqual(t, pub1, pub2)
	assert.NotEqual(t, priv1, priv2)
}

func TestParsePrivateKey(t *testing.T) {
	// Generate a token to get a valid private key
	_, _, privateKey, err := GenerateToken()
	assert.NoError(t, err)

	// Valid key should parse successfully
	key, err := ParsePrivateKey(privateKey)
	assert.NoError(t, err)
	assert.NotNil(t, key)

	// Invalid base64 should return an error
	_, err = ParsePrivateKey("not-base64!")
	assert.Error(t, err)

	// Valid base64 but not a valid key should return an error
	_, err = ParsePrivateKey(base64.StdEncoding.EncodeToString([]byte("not-a-key")))
	assert.Error(t, err)
}
