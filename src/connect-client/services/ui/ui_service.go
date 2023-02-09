package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"embed"
	"net/http"

	"connect-client/accounts"
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

	handler := newUIHandler(logger)

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

func newUIHandler(logger rslog.Logger) http.HandlerFunc {
	r := http.NewServeMux()
	api_prefix := "/api/"

	accountList := accounts.NewAccountList(logger)
	r.Handle(api_prefix+"accounts", api.NewAccountListEndpoint(accountList, logger))

	// static files for the local (account list) UI
	staticHandler := http.FileServer(http.FS(content)).ServeHTTP
	staticHandler = middleware.AddPathPrefix("/static", staticHandler)
	r.HandleFunc("/", staticHandler)

	return r.ServeHTTP
}
