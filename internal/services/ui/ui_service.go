package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployment"
	"github.com/rstudio/connect-client/internal/state"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
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
	deploymentState *state.Deployment,
	logger rslog.Logger) *api.Service {

	handler := newUIHandler(fs, deploymentState, logger)

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

func newUIHandler(afs afero.Fs, state *state.Deployment, log rslog.Logger) http.HandlerFunc {
	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.NewAccountsController(afs, log))
	// /api/files
	mux.Handle(ToPath("files"), api.NewFilesController(state.SourceDir, afs, log))
	// /api/deployment
	mux.Handle(ToPath("deployment"), deployment.NewDeploymentController(state, log))
	// /api/deployment/files
	mux.Handle(ToPath("deployment", "files"), deployment.NewFilesController(state, log))
	mux.HandleFunc("/", api.NewStaticController())
	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
