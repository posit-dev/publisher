package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"crypto"
	"crypto/md5"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/posit-dev/publisher/internal/api_client/auth/tokenutil"
)

type tokenAuthenticator struct {
	token      string
	privateKey string
}

// NewTokenAuthenticator creates an AuthMethod that adds token-based authentication headers
func NewTokenAuthenticator(token, privateKey string) (AuthMethod, error) {
	// Validate that we can parse the private key
	privateKeyObj, err := tokenutil.ParsePrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// Make sure we have a valid RSA key
	if privateKeyObj == nil {
		return nil, fmt.Errorf("invalid RSA private key")
	}

	return &tokenAuthenticator{
		token:      token,
		privateKey: privateKey,
	}, nil
}

// AddAuthHeaders adds the token-based authentication headers to the request
func (a *tokenAuthenticator) AddAuthHeaders(req *http.Request) error {
	// Get the request path without query string
	path := req.URL.Path
	if idx := strings.Index(path, "?"); idx >= 0 {
		path = path[:idx]
	}

	// Format the date in RFC2616 format
	date := time.Now().UTC().Format(http.TimeFormat)
	req.Header.Set("Date", date)

	// Calculate checksum for the request body
	var contentChecksum string

	if req.Body != nil {
		// Calculate MD5 checksum of the request body
		bodyBytes, err := io.ReadAll(req.Body)
		if err != nil {
			return fmt.Errorf("failed to read request body: %w", err)
		}

		// Restore the request body for subsequent reads
		req.Body = io.NopCloser(bytes.NewReader(bodyBytes))

		// Standard calculation for other request bodies
		md5Sum := md5.Sum(bodyBytes)
		contentChecksum = base64.StdEncoding.EncodeToString(md5Sum[:])
	} else {
		// Calculate MD5 checksum of empty string and base64 encode it
		md5Sum := md5.Sum([]byte(""))
		contentChecksum = base64.StdEncoding.EncodeToString(md5Sum[:])
	}

	// Build + sign the canonical request string
	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s", req.Method, path, date, contentChecksum)
	signature, err := signRequest(canonicalRequest, a.privateKey)
	if err != nil {
		return fmt.Errorf("failed to sign request: %w", err)
	}

	// Add the authentication headers
	req.Header.Set("X-Auth-Token", a.token)
	req.Header.Set("X-Auth-Signature", signature)
	req.Header.Set("X-Content-Checksum", contentChecksum)

	return nil
}

// signRequest signs the canonical request using the private key
func signRequest(canonicalRequest, privateKeyBase64 string) (string, error) {
	privateKey, err := tokenutil.ParsePrivateKey(privateKeyBase64)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Hash the canonical request using SHA1
	hasher := sha1.New()
	hasher.Write([]byte(canonicalRequest))
	digest := hasher.Sum(nil)

	// Sign the hash using the private key
	signature, err := privateKey.Sign(rand.Reader, digest, crypto.SHA1)
	if err != nil {
		return "", fmt.Errorf("failed to sign request: %w", err)
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}
