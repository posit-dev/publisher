package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/services/middleware"
)

type Service struct {
	handler http.HandlerFunc
	listen  string
	path    string
	addr    net.Addr
	log     logging.Logger
}

func newHTTPService(
	handler http.HandlerFunc,
	listen string,
	path string,
	accessLog bool,
	log logging.Logger) *Service {

	if accessLog {
		handler = middleware.LogRequest("Access Log", log, handler)
	}
	handler = middleware.PanicRecovery(log, handler)

	return &Service{
		handler: handler,
		listen:  listen,
		path:    path,
		addr:    nil,
		log:     log,
	}
}

func (svc *Service) getURL() *url.URL {
	scheme := "http"
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
	// Open listener first so the browser can connect
	listener, err := net.Listen("tcp", svc.listen)
	if err != nil {
		return fmt.Errorf("UI server error: %s", err)
	}

	svc.addr = listener.Addr()
	appURL := svc.getURL()

	svc.log.Info("UI server running", "url", appURL.String())
	fmt.Println(appURL.String())

	err = http.Serve(listener, svc.handler)
	if err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("UI server error: %s", err)
	}
	return nil
}
