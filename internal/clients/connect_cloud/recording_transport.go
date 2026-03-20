package connect_cloud

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// Fixture represents a single recorded HTTP interaction for golden testing.
type Fixture struct {
	Method       string          `json:"method"`
	Path         string          `json:"path"`
	Query        string          `json:"query"`
	RequestBody  json.RawMessage `json:"request_body"`
	StatusCode   int             `json:"status_code"`
	ResponseBody json.RawMessage `json:"response_body"`
}

// RecordingTransport implements http.RoundTripper and records each HTTP
// interaction as a Fixture. It delegates actual requests to the Base transport.
type RecordingTransport struct {
	Base     http.RoundTripper
	BaseURL  string
	Fixtures []Fixture
}

func (t *RecordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Read the request body (if any) so we can record it.
	var reqBodyBytes []byte
	if req.Body != nil {
		var err error
		reqBodyBytes, err = io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		// Restore the request body for the base transport.
		req.Body = io.NopCloser(bytes.NewReader(reqBodyBytes))
	}

	// Delegate to the base transport.
	resp, err := t.Base.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	// Read the response body so we can record it.
	respBodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	// Restore the response body for the caller.
	resp.Body = io.NopCloser(bytes.NewReader(respBodyBytes))

	// Strip the base URL from the recorded path.
	fullURL := req.URL.String()
	path := fullURL
	if t.BaseURL != "" {
		path = strings.TrimPrefix(fullURL, t.BaseURL)
	}
	// Separate path and query.
	recordedPath := req.URL.Path
	if t.BaseURL != "" {
		basePathEnd := strings.TrimRight(t.BaseURL, "/")
		recordedPath = strings.TrimPrefix(req.URL.Path, basePathEnd)
		// If the base URL included a path component, we may need to keep the leading slash.
		if !strings.HasPrefix(recordedPath, "/") {
			recordedPath = "/" + recordedPath
		}
	}
	_ = path // use the URL-stripped version above

	var reqBody json.RawMessage
	if len(reqBodyBytes) > 0 {
		// Only record if it's valid JSON; otherwise store as a JSON string.
		if json.Valid(reqBodyBytes) {
			reqBody = reqBodyBytes
		} else {
			reqBody, _ = json.Marshal(string(reqBodyBytes))
		}
	}

	var respBody json.RawMessage
	if len(respBodyBytes) > 0 {
		if json.Valid(respBodyBytes) {
			respBody = respBodyBytes
		} else {
			respBody, _ = json.Marshal(string(respBodyBytes))
		}
	}

	fixture := Fixture{
		Method:       req.Method,
		Path:         recordedPath,
		Query:        req.URL.RawQuery,
		RequestBody:  reqBody,
		StatusCode:   resp.StatusCode,
		ResponseBody: respBody,
	}
	t.Fixtures = append(t.Fixtures, fixture)

	return resp, nil
}
