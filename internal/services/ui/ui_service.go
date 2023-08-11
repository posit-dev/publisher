package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"

	"github.com/r3labs/sse/v2"
)

const APIPrefix string = "api"

func NewUIService(
	fragment string,
	listen string,
	keyFile string,
	certFile string,
	openBrowser bool,
	openBrowserAt string,
	skipAuth bool,
	accessLog bool,
	token services.LocalToken,
	fs afero.Fs,
	logger rslog.Logger) *api.Service {

	handler := newUIHandler(fs, logger)

	server := sse.New()
	server.CreateStream("messages")

	return api.NewService(
		handler,
		listen,
		fragment,
		keyFile,
		certFile,
		openBrowser,
		openBrowserAt,
		skipAuth,
		accessLog,
		token,
		logger,
		rslog.NewDebugLogger(debug.UIRegion),
	)
}

func newUIHandler(fs afero.Fs, logger rslog.Logger) http.HandlerFunc {
	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.NewAccountsController(fs, logger))
	// /api/files
	mux.Handle(ToPath("files"), api.NewFilesController(fs, logger))
	mux.HandleFunc("/", api.NewStaticController())
	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
