package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"

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

func newUIHandler(afs afero.Fs, deployment *state.Deployment, log rslog.Logger) http.HandlerFunc {

	var base util.Path = deployment.SourceDir

	deploymentsService := deployments.CreateDeploymentsService(deployment)
	filesService := files.CreateFilesService(base, afs, log)
	pathsService := paths.CreatePathsService(base, afs, log)

	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.GetAccountsHandlerFunc(afs, log))
	// /api/files
	mux.Handle(ToPath("files"), api.GetFileHandlerFunc(base, filesService, pathsService, log))
	// /api/deployment
	mux.Handle(ToPath("deployment"), api.GetDeploymentHandlerFunc(deploymentsService))
	// /api/deployment/files
	mux.Handle(ToPath("deployment", "files"), api.PutDeploymentFilesHandlerFunc(deploymentsService, log))
	mux.HandleFunc("/", api.NewStaticController())

	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
