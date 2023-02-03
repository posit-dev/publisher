package proxy

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/debug"
	"connect-client/services"
	"connect-client/services/api"
	"connect-client/services/middleware"
	"fmt"
	"net/http"
	"net/url"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

func NewProxyService(
	remoteName string,
	remoteUrl *url.URL,
	listen string,
	keyFile string,
	certFile string,
	openBrowser bool,
	accessLog bool,
	token services.LocalToken,
	logger rslog.Logger) *api.Service {

	path := fmt.Sprintf("/proxy/%s/", remoteName)
	handler := newProxyHandler(path, remoteUrl, logger)

	return api.NewService(
		handler,
		listen,
		path,
		keyFile,
		certFile,
		openBrowser,
		accessLog,
		token,
		logger,
		rslog.NewDebugLogger(debug.ProxyRegion),
	)
}

func newProxyHandler(path string, remoteUrl *url.URL, logger rslog.Logger) http.HandlerFunc {
	r := http.NewServeMux()

	// Proxy to Connect server for the publishing UI
	proxy := NewProxy(remoteUrl, path, logger)
	r.Handle(path, proxy)

	handler := r.ServeHTTP
	handler = middleware.RootRedirect(path, path+"publish/", handler)
	return handler
}
