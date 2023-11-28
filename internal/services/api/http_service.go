package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/internal/state"

	"github.com/pkg/browser"
)

type Service struct {
	state         *state.State
	handler       http.HandlerFunc
	listen        string
	path          string
	keyFile       string
	certFile      string
	openBrowser   bool
	openBrowserAt string
	addr          net.Addr
	log           logging.Logger
}

var errTlsRequiredFiles error = errors.New("TLS requires both a private key file and a certificate chain file")

func NewService(
	state *state.State,
	handler http.HandlerFunc,
	listen string,
	path string,
	keyFile string,
	certFile string,
	openBrowser bool,
	openBrowserAt string,
	accessLog bool,
	log logging.Logger) *Service {

	if accessLog {
		handler = middleware.LogRequest("Access Log", log, handler)
	}
	handler = middleware.PanicRecovery(log, handler)

	return &Service{
		state:         state,
		handler:       handler,
		listen:        listen,
		path:          path,
		keyFile:       keyFile,
		certFile:      certFile,
		openBrowser:   openBrowser,
		openBrowserAt: openBrowserAt,
		addr:          nil,
		log:           log,
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

func (svc *Service) getURL() *url.URL {
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
	appURL := svc.getURL()

	svc.log.Info("UI server running", "url", appURL.String())
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
