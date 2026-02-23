package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ProxySuite struct {
	utiltest.Suite
	log       logging.Logger
	logBuffer *bytes.Buffer
}

func TestProxySuite(t *testing.T) {
	suite.Run(t, new(ProxySuite))
}

func (s *ProxySuite) SetupTest() {
	s.logBuffer = new(bytes.Buffer)
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	stdLogger := slog.New(slog.NewTextHandler(s.logBuffer, opts))
	s.log = logging.FromStdLogger(stdLogger)
}

func (s *ProxySuite) TestBasicProxy() {
	// Create a test backend server
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Test-Header", "test-value")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("backend response"))
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	// Create test request
	req := httptest.NewRequest(http.MethodGet, "/proxy/test/path", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("backend response", rec.Body.String())
	s.Equal("test-value", rec.Header().Get("X-Test-Header"))
}

func (s *ProxySuite) TestPathStripping() {
	// Verify that the sourcePath is stripped from requests
	var receivedPath string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/api/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/api/proxy/some/nested/path", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("/some/nested/path", receivedPath)
}

func (s *ProxySuite) TestPathStrippingToRoot() {
	// Verify that stripping to empty path results in "/"
	var receivedPath string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("/", receivedPath)
}

func (s *ProxySuite) TestQueryStringPreserved() {
	// Verify query strings are preserved through the proxy
	var receivedQuery string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path?foo=bar&baz=qux", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("foo=bar&baz=qux", receivedQuery)
}

func (s *ProxySuite) TestCookiesStripped() {
	// Verify cookies are not forwarded to backend
	var receivedCookie string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedCookie = r.Header.Get("Cookie")
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	req.Header.Set("Cookie", "session=abc123; auth=xyz789")
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Empty(receivedCookie)
}

func (s *ProxySuite) TestHostHeaderSet() {
	// Verify Host header is set to target host
	var receivedHost string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHost = r.Host
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	req.Host = "original-host.example.com"
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal(targetURL.Host, receivedHost)
}

func (s *ProxySuite) TestRefererRewritten() {
	// Verify Referer header is rewritten to target URL
	var receivedReferer string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedReferer = r.Header.Get("Referer")
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	req.Header.Set("Referer", "http://localhost:8080/proxy/previous/page")
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal(backend.URL+"/previous/page", receivedReferer)
}

func (s *ProxySuite) TestRefererEmpty() {
	// Verify empty Referer is handled gracefully
	var receivedReferer string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedReferer = r.Header.Get("Referer")
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	// No Referer header set
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Empty(receivedReferer)
}

func (s *ProxySuite) TestLocationHeaderRewritten() {
	// Verify Location header in redirects is rewritten
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Redirect to an absolute URL on the backend
		w.Header().Set("Location", "http://"+r.Host+"/new/location")
		w.WriteHeader(http.StatusFound)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/old/path", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusFound, rec.Code)
	s.Equal("/proxy/new/location", rec.Header().Get("Location"))
}

func (s *ProxySuite) TestLocationHeaderRelativeUnchanged() {
	// Verify relative Location headers are not modified
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "/relative/path")
		w.WriteHeader(http.StatusFound)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/old/path", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusFound, rec.Code)
	s.Equal("/relative/path", rec.Header().Get("Location"))
}

func (s *ProxySuite) TestErrorHandler() {
	// Verify error handler returns 502 Bad Gateway
	// Use an invalid target URL that will fail to connect
	targetURL, err := url.Parse("http://127.0.0.1:1")
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusBadGateway, rec.Code)
}

func (s *ProxySuite) TestPostRequestBody() {
	// Verify POST request bodies are forwarded
	var receivedBody string
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		receivedBody = string(body)
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	body := `{"key": "value"}`
	req := httptest.NewRequest(http.MethodPost, "/proxy/api/endpoint", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal(body, receivedBody)
}

func (s *ProxySuite) TestProxyURL() {
	targetURL, err := url.Parse("https://connect.example.com/content/123")
	s.NoError(err)

	p := proxy{
		targetURL:  targetURL,
		sourcePath: "/proxy",
		log:        s.log,
	}

	// Test basic URL mapping
	result, err := p.proxyURL("http://localhost:8080/proxy/some/path")
	s.NoError(err)
	s.Equal("https://connect.example.com/some/path", result)
}

func (s *ProxySuite) TestProxyURLWithQueryString() {
	targetURL, err := url.Parse("https://connect.example.com")
	s.NoError(err)

	p := proxy{
		targetURL:  targetURL,
		sourcePath: "/proxy",
		log:        s.log,
	}

	result, err := p.proxyURL("http://localhost:8080/proxy/path?foo=bar&baz=qux")
	s.NoError(err)
	s.Equal("https://connect.example.com/path?foo=bar&baz=qux", result)
}

func (s *ProxySuite) TestProxyURLToRoot() {
	targetURL, err := url.Parse("https://connect.example.com")
	s.NoError(err)

	p := proxy{
		targetURL:  targetURL,
		sourcePath: "/proxy",
		log:        s.log,
	}

	result, err := p.proxyURL("http://localhost:8080/proxy")
	s.NoError(err)
	s.Equal("https://connect.example.com/", result)
}

func (s *ProxySuite) TestProxyURLInvalidURL() {
	targetURL, err := url.Parse("https://connect.example.com")
	s.NoError(err)

	p := proxy{
		targetURL:  targetURL,
		sourcePath: "/proxy",
		log:        s.log,
	}

	_, err = p.proxyURL("://invalid-url")
	s.Error(err)
}

func (s *ProxySuite) TestOtherHeadersPreserved() {
	// Verify other headers (not Cookie) are forwarded
	var receivedHeaders http.Header
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaders = r.Header.Clone()
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	targetURL, err := url.Parse(backend.URL)
	s.NoError(err)

	proxy := NewProxy(targetURL, "/proxy", s.log)

	req := httptest.NewRequest(http.MethodGet, "/proxy/path", nil)
	req.Header.Set("X-Custom-Header", "custom-value")
	req.Header.Set("Accept", "application/json")
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	s.Equal(http.StatusOK, rec.Code)
	s.Equal("custom-value", receivedHeaders.Get("X-Custom-Header"))
	s.Equal("application/json", receivedHeaders.Get("Accept"))
}
