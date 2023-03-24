package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"io"
	"net/http"
	"strings"
)

// GetRequestBody reads the body of an http client request.
// It returns the body and makes req.Body ready to read again.
func GetRequestBody(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return nil, nil
	}
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	// Ensure that the body can be read again
	// when it's time to send the request.
	req.Body = io.NopCloser(bytes.NewReader(body))
	return body, nil
}

// URLJoin joins two url parts with a slash.
func URLJoin(a, b string) string {
	return strings.TrimRight(a, "/") + "/" + strings.TrimLeft(b, "/")
}
