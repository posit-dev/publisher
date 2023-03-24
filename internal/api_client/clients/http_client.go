package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/api_client/auth"
	"github.com/rstudio/connect-client/internal/util"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"golang.org/x/net/publicsuffix"
)

type HTTPClient struct {
	client  *http.Client
	baseURL string
}

func NewHTTPClient(account *accounts.Account, timeout time.Duration, logger rslog.Logger) (*HTTPClient, error) {
	baseClient, err := newHTTPClientForAccount(account, timeout, logger)
	if err != nil {
		return nil, err
	}
	return &HTTPClient{
		client:  baseClient,
		baseURL: account.URL,
	}, nil
}

var errAuthenticationFailed = errors.New("Unable to log in with the provided credentials.")

func (c *HTTPClient) do(method string, path string, body io.Reader, bodyType string) ([]byte, error) {
	apiURL := util.URLJoin(c.baseURL, path)
	req, err := http.NewRequest(method, apiURL, body)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return nil, errAuthenticationFailed
	case http.StatusOK, http.StatusCreated, http.StatusAccepted:
		return io.ReadAll(resp.Body)
	case http.StatusNoContent:
		return nil, nil
	default:
		return nil, fmt.Errorf("Unexpected response from the server: %s on URL %s", resp.Status, req.URL.String())
	}
}

func (c *HTTPClient) doJSON(method string, path string, body any, into any) error {
	reqBody := io.Reader(nil)
	if body != nil {
		bodyJSON, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(bodyJSON)
	}
	respBody, err := c.do(method, path, reqBody, "application/json")
	if err != nil {
		return err
	}
	if into != nil {
		err = json.Unmarshal(respBody, into)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *HTTPClient) getRaw(path string) ([]byte, error) {
	return c.do("GET", path, nil, "")
}

func (c *HTTPClient) postRaw(path string, body io.Reader, bodyType string) ([]byte, error) {
	return c.do("POST", path, body, bodyType)
}

func (c *HTTPClient) get(path string, into any) error {
	return c.doJSON("GET", path, nil, into)
}

func (c *HTTPClient) post(path string, body any, into any) error {
	return c.doJSON("POST", path, body, into)
}

func (c *HTTPClient) put(path string, body any, into any) error {
	return c.doJSON("PUT", path, body, into)
}

func (c *HTTPClient) patch(path string, body any, into any) error {
	return c.doJSON("PATCH", path, body, into)
}

func (c *HTTPClient) delete(path string) error {
	return c.doJSON("DELETE", path, nil, nil)
}

func loadCACertificates(path string, logger rslog.Logger) (*x509.CertPool, error) {
	if path == "" {
		return nil, nil
	}
	logger.Infof("Loading CA certificate from %s", path)
	certificate, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("Error reading certificate file: %s", err)
	}
	certPool := x509.NewCertPool()
	ok := certPool.AppendCertsFromPEM(certificate)
	if !ok {
		return nil, fmt.Errorf("No PEM certificates were found in the certificate file '%s'", path)
	}
	return certPool, nil
}

func newHTTPClientForAccount(account *accounts.Account, timeout time.Duration, logger rslog.Logger) (*http.Client, error) {
	cookieJar, err := cookiejar.New(&cookiejar.Options{
		PublicSuffixList: publicsuffix.List,
	})
	if err != nil {
		return nil, err
	}
	certPool, err := loadCACertificates(account.Certificate, logger)
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
