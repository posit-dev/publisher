package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
	"net/http"

	"connect-client/debug"
	"connect-client/services"
	"connect-client/services/api"
	"connect-client/services/middleware"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

//go:embed static/*
var content embed.FS

func NewUIService(
	host string,
	port int,
	path string,
	keyFile string,
	certFile string,
	openBrowser bool,
	token services.LocalToken,
	logger rslog.Logger) *api.Service {

	handler := newUIHandler(path)

	return api.NewService(
		handler,
		host,
		port,
		path,
		keyFile,
		certFile,
		openBrowser,
		token,
		logger,
		rslog.NewDebugLogger(debug.UIRegion),
	)
}

func newUIHandler(path string) http.HandlerFunc {
	r := http.NewServeMux()

	// static files for the local (server list) UI
	r.Handle("/", http.FileServer(http.FS(content)))

	// More APIs to come...

	handler := r.ServeHTTP
	handler = middleware.AddPathPrefix("/static", handler)
	return handler
}
