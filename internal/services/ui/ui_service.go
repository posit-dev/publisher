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
)

var APIPrefix string = "api"

func NewUIService(
	fragment string,
	listen string,
	keyFile string,
	certFile string,
	openBrowser bool,
	accessLog bool,
	token services.LocalToken,
	fs afero.Fs,
	logger rslog.Logger) *api.Service {

	handler := newUIHandler(fs, logger)

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

func newUIHandler(fs afero.Fs, logger rslog.Logger) http.HandlerFunc {
	mux := http.NewServeMux()
	mux.Handle(ToPath("accounts"), api.NewAccountsController(fs, logger))
	mux.Handle(ToPath("files"), api.NewFilesController())
	mux.HandleFunc("/", api.NewStaticController())
	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	path, _ := url.JoinPath(APIPrefix, elements...)
	return path
}
