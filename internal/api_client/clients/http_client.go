package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"

	"github.com/rstudio/publishing-client/internal/accounts"
	"github.com/rstudio/publishing-client/internal/api_client/auth"
	"github.com/rstudio/publishing-client/internal/events"
	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/types"
	"github.com/rstudio/publishing-client/internal/util"

	"golang.org/x/net/publicsuffix"
)

type HTTPClient interface {
	GetRaw(path string) ([]byte, error)
	PostRaw(path string, body io.Reader, bodyType string) ([]byte, error)
	Get(path string, into any) error
	Post(path string, body any, into any) error
	Put(path string, body any, into any) error
	Patch(path string, body any, into any) error
	Delete(path string) error
}

type defaultHTTPClient struct {
	client  *http.Client
	baseURL string
	log     logging.Logger
}

func NewDefaultHTTPClient(account *accounts.Account, timeout time.Duration, log logging.Logger) (*defaultHTTPClient, error) {
	baseClient, err := newHTTPClientForAccount(account, timeout, log)
	if err != nil {
		return nil, err
	}
	return &defaultHTTPClient{
		client:  baseClient,
		baseURL: account.URL,
		log:     log,
	}, nil
}

type HTTPError struct {
	URL    string
	Method string
	Status int
}

func NewHTTPError(url, method string, status int) *HTTPError {
	return &HTTPError{
		URL:    url,
		Method: method,
		Status: status,
	}
}

func (e *HTTPError) Error() string {
	return "unexpected response from the server"
}

func (c *defaultHTTPClient) do(method string, path string, body io.Reader, bodyType string) ([]byte, error) {
	apiURL := util.URLJoin(c.baseURL, path)
	req, err := http.NewRequest(method, apiURL, body)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		if e, ok := err.(net.Error); ok && e.Timeout() {
			return nil, types.NewAgentError(events.OperationTimedOutCode, err, nil)
		}
		return nil, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK, http.StatusCreated, http.StatusAccepted:
		return io.ReadAll(resp.Body)
	case http.StatusNoContent:
		return nil, nil
	default:
		// If this was a Connect API error, there should be
		// helpful error information in the json body.
		var errDetails map[string]any

		body, err := io.ReadAll(resp.Body)
		if err == nil {
			_ = json.Unmarshal(body, &errDetails)
		}
		errCode := events.ServerErrorCode
		switch resp.StatusCode {
		case http.StatusUnauthorized:
			errCode = events.AuthenticationFailedCode
		case http.StatusForbidden:
			errCode = events.PermissionsCode
		}
		err = types.NewAgentError(
			errCode,
			NewHTTPError(apiURL, method, resp.StatusCode),
			errDetails)
		return nil, err
	}
}

func (c *defaultHTTPClient) doJSON(method string, path string, body any, into any) error {
	reqBody := io.Reader(nil)
	bodyJSON := []byte(nil)
	var err error

	if body != nil {
		bodyJSON, err = json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(bodyJSON)
	}
	respBody, err := c.do(method, path, reqBody, "application/json")
	if c.log.Enabled(context.Background(), slog.LevelDebug) {
		c.log.Debug("API request", "method", method, "path", path, "body", string(bodyJSON), "response", string(respBody), "error", err)
	}
	if err != nil {
		return err
	}
	if respBody == nil {
		return nil
	}
	if into != nil {
		err = json.Unmarshal(respBody, into)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *defaultHTTPClient) GetRaw(path string) ([]byte, error) {
	return c.do("GET", path, nil, "")
}

func (c *defaultHTTPClient) PostRaw(path string, body io.Reader, bodyType string) ([]byte, error) {
	return c.do("POST", path, body, bodyType)
}

func (c *defaultHTTPClient) Get(path string, into any) error {
	return c.doJSON("GET", path, nil, into)
}

func (c *defaultHTTPClient) Post(path string, body any, into any) error {
	return c.doJSON("POST", path, body, into)
}

func (c *defaultHTTPClient) Put(path string, body any, into any) error {
	return c.doJSON("PUT", path, body, into)
}

func (c *defaultHTTPClient) Patch(path string, body any, into any) error {
	return c.doJSON("PATCH", path, body, into)
}

func (c *defaultHTTPClient) Delete(path string) error {
	return c.doJSON("DELETE", path, nil, nil)
}

func loadCACertificates(path string, log logging.Logger) (*x509.CertPool, error) {
	if path == "" {
		return nil, nil
	}
	log.Info("Loading CA certificate", "path", path)
	certificate, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("Error reading certificate file: %w", err)
	}
	certPool := x509.NewCertPool()
	ok := certPool.AppendCertsFromPEM(certificate)
	if !ok {
		return nil, fmt.Errorf("no PEM certificates were found in the certificate file '%s'", path)
	}
	return certPool, nil
}

func newHTTPClientForAccount(account *accounts.Account, timeout time.Duration, log logging.Logger) (*http.Client, error) {
	cookieJar, err := cookiejar.New(&cookiejar.Options{
		PublicSuffixList: publicsuffix.List,
	})
	if err != nil {
		return nil, err
	}
	certPool, err := loadCACertificates(account.Certificate, log)
	if err != nil {
		return nil, err
	}

	// Based on http.DefaultTransport with customized dialer timeout and TLS config.
	dialer := net.Dialer{
		Timeout:   timeout,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: account.Insecure,
			RootCAs:            certPool,
		},
	}
	authTransport := NewAuthenticatedTransport(transport, auth.NewClientAuth(account))
	return &http.Client{
		Jar:       cookieJar,
		Timeout:   timeout,
		Transport: authTransport,
	}, nil
}
