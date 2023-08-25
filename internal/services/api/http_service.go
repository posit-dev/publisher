package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/internal/state"

	"github.com/pkg/browser"
)

type Service struct {
	state         *state.Deployment
	handler       http.HandlerFunc
	listen        string
	path          string
	keyFile       string
	certFile      string
	openBrowser   bool
	openBrowserAt string
	skipAuth      bool
	token         services.LocalToken
	addr          net.Addr
	logger        events.Logger
}

var errTlsRequiredFiles error = errors.New("TLS requires both a private key file and a certificate chain file")

func NewService(
	state *state.Deployment,
	handler http.HandlerFunc,
	listen string,
	path string,
	keyFile string,
	certFile string,
	openBrowser bool,
	openBrowserAt string,
	skipAuth bool,
	accessLog bool,
	token services.LocalToken,
	logger events.Logger) *Service {

	if project.DevelopmentBuild() && skipAuth {
		logger.Warn("Service is operating in DEVELOPMENT MODE with NO browser to server authentication")
	} else {
		handler = middleware.AuthRequired(logger, handler)
		handler = middleware.CookieSession(logger, handler)
		handler = middleware.LocalTokenSession(token, logger, handler)
	}

	if accessLog {
		handler = middleware.LogRequest("Access Log", logger, handler)
	}
	handler = middleware.PanicRecovery(logger, handler)

	return &Service{
		state:         state,
		handler:       handler,
		listen:        listen,
		path:          path,
		keyFile:       keyFile,
		certFile:      certFile,
		openBrowser:   openBrowser,
		openBrowserAt: openBrowserAt,
		skipAuth:      skipAuth,
		token:         token,
		addr:          nil,
		logger:        logger,
	}
}

func (svc *Service) isTLS() (bool, error) {
	if svc.keyFile != "" && svc.certFile != "" {
		return true, nil
	} else if svc.keyFile != "" || svc.certFile != "" {
		// It's an error to only provide one of the files
		return false, errTlsRequiredFiles
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
	if err != nil {
		return fmt.Errorf("UI server error: %s", err)
	}

	svc.addr = listener.Addr()

	// If not development mode, then you get a token added to the URL
	appURL := svc.getURL(!(project.DevelopmentBuild() && svc.skipAuth))

	svc.logger.Info("UI server running", "url", appURL.String())
	fmt.Println(appURL.String())

	if project.DevelopmentBuild() && svc.openBrowserAt != "" {
		browser.OpenURL(svc.openBrowserAt)
	} else if svc.openBrowser {
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
