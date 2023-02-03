package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"connect-client/services"
	"connect-client/services/middleware"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type Service struct {
	handler     http.HandlerFunc
	host        string
	port        int
	path        string
	keyFile     string
	certFile    string
	openBrowser bool
	token       services.LocalToken
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

var tlsRequiredFilesError = errors.New("TLS requires both a private key file and a certificate chain file")

func NewService(
	handler http.HandlerFunc,
	host string,
	port int,
	path string,
	keyFile string,
	certFile string,
	openBrowser bool,
	token services.LocalToken,
	logger rslog.Logger,
	debugLogger rslog.DebugLogger) *Service {

	handler = middleware.AuthRequired(logger, handler)
	handler = middleware.CookieSession(logger, handler)
	handler = middleware.LocalTokenSession(token, logger, handler)

	return &Service{
		handler:     handler,
		host:        host,
		port:        port,
		path:        path,
		keyFile:     keyFile,
		certFile:    certFile,
		openBrowser: openBrowser,
		token:       token,
		logger:      logger,
		debugLogger: debugLogger,
	}
}

func (svc *Service) isTLS() (bool, error) {
	if svc.keyFile != "" && svc.certFile != "" {
		return true, nil
	} else if svc.keyFile != "" || svc.certFile != "" {
		// It's an error to only provide one of the files
		return false, tlsRequiredFilesError
	} else {
		return false, nil
	}
}

func (svc *Service) getURL(includeToken bool) *url.URL {
	scheme := "http"
	isTLS, _ := svc.isTLS()
	if isTLS {
		scheme = "https"
	}
	addr := fmt.Sprintf("%s:%d", svc.host, svc.port)

	path, fragment, _ := strings.Cut(svc.path, "#")
	appURL := &url.URL{
		Scheme:   scheme,
		Host:     addr,
		Path:     path,
		Fragment: fragment,
	}
	if includeToken {
		appURL.RawQuery = url.Values{
			"token": []string{string(svc.token)},
		}.Encode()
	}
	return appURL
}

func (svc *Service) Run() error {
	isTLS, err := svc.isTLS()
	if err != nil {
		return err
	}

	// Log without the token
	appURL := svc.getURL(false)
	svc.logger.Infof("UI server URL: %s", appURL.String())

	// Show the user full URL including the token
	appURL = svc.getURL(true)
	fmt.Printf("%s\n", appURL.String())

	if isTLS {
		err = http.ListenAndServeTLS(appURL.Host, svc.keyFile, svc.certFile, svc.handler)
	} else {
		err = http.ListenAndServe(appURL.Host, svc.handler)
	}
	if err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("UI server error: %s", err)
	}
	return nil
}
