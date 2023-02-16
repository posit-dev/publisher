package clients

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/accounts"
	"connect-client/api_client/auth"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"golang.org/x/net/publicsuffix"
)

type ContentID string
type BundleID string
type TaskID string

// Simplified task structure common to all servers
type Task struct {
	Finished bool
	Output   []string
	Error    string
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() error
	CreateDeployment() (ContentID, error)
	// DeployBundle(ContentID, io.Reader) (BundleID, TaskID, error)
	GetTask(TaskID) (*Task, error)
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
	authTransport := &AuthenticatedTransport{
		Base: transport,
		Auth: auth.NewClientAuth(account),
	}
	return &http.Client{
		Jar:       cookieJar,
		Timeout:   timeout,
		Transport: authTransport,
	}, nil
}
