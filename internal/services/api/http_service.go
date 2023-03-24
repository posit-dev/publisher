package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/middleware"

	"github.com/pkg/browser"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type Service struct {
	handler     http.HandlerFunc
	listen      string
	path        string
	keyFile     string
	certFile    string
	openBrowser bool
	token       services.LocalToken
	addr        net.Addr
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

var tlsRequiredFilesError = errors.New("TLS requires both a private key file and a certificate chain file")

func NewService(
	handler http.HandlerFunc,
	listen string,
	path string,
	keyFile string,
	certFile string,
	openBrowser bool,
	accessLog bool,
	token services.LocalToken,
	logger rslog.Logger,
	debugLogger rslog.DebugLogger) *Service {

	handler = middleware.AuthRequired(logger, handler)
	handler = middleware.CookieSession(logger, handler)
	handler = middleware.LocalTokenSession(token, logger, handler)
	if accessLog {
		handler = middleware.LogRequest("Access Log", logger, handler)
	}
	handler = middleware.PanicRecovery(logger, debugLogger, handler)

	return &Service{
		handler:     handler,
		listen:      listen,
		path:        path,
		keyFile:     keyFile,
		certFile:    certFile,
		openBrowser: openBrowser,
		token:       token,
		addr:        nil,
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
	path, fragment, _ := strings.Cut(svc.path, "#")
	appURL := &url.URL{
		Scheme:   scheme,
		Host:     svc.addr.String(),
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

	// Open listener first so the browser can connect
	listener, err := net.Listen("tcp", svc.listen)
	svc.addr = listener.Addr()

	// Log without the token
	appURL := svc.getURL(false)
	svc.logger.Infof("UI server URL: %s", appURL.String())

	// Show the user full URL including the token
	appURL = svc.getURL(true)
	fmt.Printf("%s\n", appURL.String())

	if svc.openBrowser {
		browser.OpenURL(appURL.String())
	}
	if isTLS {
		err = http.ServeTLS(listener, svc.handler, svc.certFile, svc.keyFile)
	} else {
		err = http.Serve(listener, svc.handler)
	}
	if err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("UI server error: %s", err)
	}
	return nil
}
