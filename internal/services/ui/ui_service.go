package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployment"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/web"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

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

func newUIHandler(fs afero.Fs, deploymentState *state.Deployment, logger rslog.Logger) http.HandlerFunc {
	r := http.NewServeMux()
	api_prefix := "/api/"

	accountList := accounts.NewAccountList(fs, logger)
	r.Handle(api_prefix+"accounts", api.NewAccountListEndpoint(accountList, logger))

	deployment_prefix := api_prefix + "deployment/"
	r.Handle(deployment_prefix+"files", deployment.NewSelectedFilesEndpoint(deploymentState, logger))

	// static files for the local (account list) UI
	staticHandler := http.FileServer(http.FS(web.Dist)).ServeHTTP
	staticHandler = middleware.AddPathPrefix("/dist/spa", staticHandler)
	r.HandleFunc("/", staticHandler)

	return r.ServeHTTP
}
