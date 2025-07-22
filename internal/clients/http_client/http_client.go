package http_client

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
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"

	"golang.org/x/net/publicsuffix"
)

type HTTPClient interface {
	GetRaw(path string, log logging.Logger) ([]byte, error)
	PostRaw(path string, body io.Reader, bodyType string, log logging.Logger) ([]byte, error)
	Get(path string, into any, log logging.Logger) error
	Post(path string, body any, into any, log logging.Logger) error
	PostForm(path string, data url.Values, into any, log logging.Logger) error
	Put(path string, body any, into any, log logging.Logger) error
	Patch(path string, body any, into any, log logging.Logger) error
	Delete(path string, log logging.Logger) error
}

type defaultHTTPClient struct {
	client  *http.Client
	baseURL string
}

func NewDefaultHTTPClient(account *accounts.Account, timeout time.Duration, log logging.Logger) (*defaultHTTPClient, error) {
	baseClient, err := newHTTPClientForAccount(account, timeout, log)
	if err != nil {
		return nil, err
	}
	return &defaultHTTPClient{
		client:  baseClient,
		baseURL: account.URL,
	}, nil
}

func NewBasicHTTPClient(baseURL string, timeout time.Duration) *defaultHTTPClient {
	baseClient := newBasicInternalHTTPClient(timeout)
	return &defaultHTTPClient{
		client:  baseClient,
		baseURL: baseURL,
	}
}

func NewBasicHTTPClientWithAuth(baseURL string, timeout time.Duration, authHeader string) *defaultHTTPClient {
	baseClient := newBasicInternalHTTPClientWithAuth(timeout, authHeader)
	return &defaultHTTPClient{
		client:  baseClient,
		baseURL: baseURL,
	}
}

type HTTPError struct {
	URL    string `mapstructure:"url"`
	Method string `mapstructure:"method"`
	Status int    `mapstructure:"status"`
	Body   string `mapstructure:"body"`
}

func NewHTTPError(url, method string, status int, body string) *HTTPError {
	return &HTTPError{
		URL:    url,
		Method: method,
		Status: status,
		Body:   body,
	}
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("unexpected response from the server (%d: %s)", e.Status, e.Body)
}

func (c *defaultHTTPClient) do(method string, path string, body io.Reader, bodyType string, log logging.Logger) ([]byte, error) {
	apiURL := util.URLJoin(c.baseURL, path)
	req, err := http.NewRequest(method, apiURL, body)
	if err != nil {
		return nil, err
	}
	if bodyType != "" {
		req.Header.Set("Content-Type", bodyType)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		if e, ok := err.(net.Error); ok && e.Timeout() {
			return nil, types.NewAgentError(events.OperationTimedOutCode, err, nil)
		}
		return nil, types.NewAgentError(events.ConnectionFailedCode, err, nil)
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
		httpErr := NewHTTPError(apiURL, method, resp.StatusCode, string(body))
		if errDetails == nil {
			err = types.NewAgentError(
				errCode,
				httpErr,
				httpErr) // the error object contains its own details
		} else {
			err = types.NewAgentError(
				errCode,
				httpErr,
				errDetails)
		}
		return nil, err
	}
}

func (c *defaultHTTPClient) doJSON(method string, path string, body any, into any, log logging.Logger) error {
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
	respBody, err := c.do(method, path, reqBody, "application/json", log)
	if log.Enabled(context.Background(), slog.LevelDebug) {
		const maxBody = 2000
		trimmedRespBody := respBody
		if len(trimmedRespBody) > maxBody {
			trimmedRespBody = trimmedRespBody[:maxBody]
		}
		log.Debug("API request", "method", method, "path", path, "body", string(bodyJSON), "response", string(trimmedRespBody), "error", err)
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

func (c *defaultHTTPClient) doFormEncoded(method string, path string, body url.Values, into any, log logging.Logger) error {
	reqBody := io.Reader(nil)
	if body != nil {
		reqBody = strings.NewReader(body.Encode())
	}
	respBody, err := c.do(method, path, reqBody, "application/x-www-form-urlencoded", log)
	if log.Enabled(context.Background(), slog.LevelDebug) {
		const maxBody = 2000
		trimmedRespBody := respBody
		if len(trimmedRespBody) > maxBody {
			trimmedRespBody = trimmedRespBody[:maxBody]
		}
		log.Debug("API request", "method", method, "path", path, "body", body.Encode(), "response", string(trimmedRespBody), "error", err)
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

func (c *defaultHTTPClient) GetRaw(path string, log logging.Logger) ([]byte, error) {
	return c.do("GET", path, nil, "", log)
}

func (c *defaultHTTPClient) PostRaw(path string, body io.Reader, bodyType string, log logging.Logger) ([]byte, error) {
	return c.do("POST", path, body, bodyType, log)
}

func (c *defaultHTTPClient) Get(path string, into any, log logging.Logger) error {
	return c.doJSON("GET", path, nil, into, log)
}

func (c *defaultHTTPClient) Post(path string, body any, into any, log logging.Logger) error {
	return c.doJSON("POST", path, body, into, log)
}

func (c *defaultHTTPClient) PostForm(path string, body url.Values, into any, log logging.Logger) error {
	return c.doFormEncoded("POST", path, body, into, log)
}

func (c *defaultHTTPClient) Put(path string, body any, into any, log logging.Logger) error {
	return c.doJSON("PUT", path, body, into, log)
}

func (c *defaultHTTPClient) Patch(path string, body any, into any, log logging.Logger) error {
	return c.doJSON("PATCH", path, body, into, log)
}

func (c *defaultHTTPClient) Delete(path string, log logging.Logger) error {
	return c.doJSON("DELETE", path, nil, nil, log)
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

func newTransport() *http.Transport {
	// Based on http.DefaultTransport with customized dialer timeout.
	dialer := net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	return &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
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

	transport := newTransport()
	transport.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: account.Insecure,
		RootCAs:            certPool,
	}
	clientAuth, err := auth.NewAuthFactory().NewClientAuth(account)
	if err != nil {
		return nil, err
	}
	authTransport := NewAuthenticatedTransport(transport, clientAuth)
	return &http.Client{
		Jar:       cookieJar,
		Timeout:   timeout,
		Transport: authTransport,
	}, nil
}

func newBasicInternalHTTPClient(timeout time.Duration) *http.Client {
	// Based on http.DefaultTransport with customized dialer timeout.
	transport := newTransport()
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}
}

func newBasicInternalHTTPClientWithAuth(timeout time.Duration, authValue string) *http.Client {
	transport := newTransport()
	clientAuth := auth.NewPlainAuthenticator(authValue)
	authTransport := NewAuthenticatedTransport(transport, clientAuth)
	return &http.Client{
		Timeout:   timeout,
		Transport: authTransport,
	}
}

func IsHTTPAgentErrorStatusOf(err error, status int) (*types.AgentError, bool) {
	if aerr, isAgentErr := err.(*types.AgentError); isAgentErr {
		if httperr, isHttpErr := aerr.Err.(*HTTPError); isHttpErr {
			return aerr, httperr.Status == status
		}

	}
	return nil, false
}
