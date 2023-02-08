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
	fragment string,
	listen string,
	keyFile string,
	certFile string,
	openBrowser bool,
	accessLog bool,
	token services.LocalToken,
	logger rslog.Logger) *api.Service {

	handler := newUIHandler()

	return api.NewService(
		handler,
		listen,
		fragment,
		keyFile,
		certFile,
		openBrowser,
		accessLog,
		token,
		logger,
		rslog.NewDebugLogger(debug.UIRegion),
	)
}

func newUIHandler() http.HandlerFunc {
	r := http.NewServeMux()

	// static files for the local (account list) UI
	r.Handle("/", http.FileServer(http.FS(content)))

	// More APIs to come...

	handler := r.ServeHTTP
	handler = middleware.AddPathPrefix("/static", handler)
	return handler
}
