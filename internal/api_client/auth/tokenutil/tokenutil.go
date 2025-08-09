package tokenutil

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
)

// GenerateToken creates a new token with a randomly generated RSA key pair
// The token ID is prefixed with "T" and contains random bytes
// Returns the token ID, base64 encoded public key, and base64 encoded private key
func GenerateToken() (string, string, string, error) {
	// Generate RSA key pair (2048 bits like in rsconnect)
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate RSA key pair: %w", err)
	}

	// Extract public key
	publicKey := &privateKey.PublicKey

	// Generate a random token ID prefixed with "T"
	tokenBytes := make([]byte, 16)
	_, err = rand.Read(tokenBytes)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate token ID: %w", err)
	}
	tokenID := fmt.Sprintf("T%x", tokenBytes)

	// Encode private key to DER format (binary)
	privateKeyDER := x509.MarshalPKCS1PrivateKey(privateKey)
	privateKeyBase64 := base64.StdEncoding.EncodeToString(privateKeyDER)

	// Encode public key to DER format (binary)
	publicKeyDER, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to marshal public key: %w", err)
	}
	publicKeyBase64 := base64.StdEncoding.EncodeToString(publicKeyDER)

	return tokenID, publicKeyBase64, privateKeyBase64, nil
}

// ParsePrivateKey decodes a base64-encoded private key string into an RSA private key
func ParsePrivateKey(privateKeyBase64 string) (*rsa.PrivateKey, error) {
	// Decode base64 string to DER binary
	privateKeyDER, err := base64.StdEncoding.DecodeString(privateKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	// Parse DER private key
	privateKey, err := x509.ParsePKCS1PrivateKey(privateKeyDER)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	return privateKey, nil
}

// TokenRequest represents a token request to the Connect API
type TokenRequest struct {
	Token     string `json:"token"`
	PublicKey string `json:"public_key"`
	UserID    int    `json:"user_id"`
}

// TokenResponse represents the response from the Connect API for a token request
type TokenResponse struct {
	TokenClaimURL string `json:"token_claim_url"`
}

// ErrTokenUnclaimed is returned when trying to use an unclaimed token
var ErrTokenUnclaimed = errors.New("token is unclaimed")

// ErrAuthenticationFailed is returned when token authentication fails
var ErrAuthenticationFailed = errors.New("token authentication failed")
