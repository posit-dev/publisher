package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"log/slog"
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/web"

	"github.com/gorilla/mux"
	"github.com/spf13/afero"
)

const APIPrefix string = "api"

func NewUIService(
	fragment string,
	ui cli_types.UIArgs,
	publish *cli_types.PublishArgs,
	token services.LocalToken,
	fs afero.Fs,
	lister accounts.AccountList,
	logger *slog.Logger) *api.Service {

	handler := RouterHandlerFunc(fs, publish, lister, logger)

	return api.NewService(
		publish.State,
		handler,
		ui.Listen,
		fragment,
		ui.TLSKeyFile,
		ui.TLSCertFile,
		ui.Interactive,
		ui.OpenBrowserAt,
		ui.SkipBrowserSessionAuth,
		ui.AccessLog,
		token,
		logger,
	)
}

func RouterHandlerFunc(afs afero.Fs, publishArgs *cli_types.PublishArgs, lister accounts.AccountList, log *slog.Logger) http.HandlerFunc {

	deployment := publishArgs.State
	base := deployment.SourceDir

	deploymentsService := deployments.CreateDeploymentsService(deployment)
	filesService := files.CreateFilesService(base, afs, log)
	pathsService := paths.CreatePathsService(base, afs, log)

	r := mux.NewRouter()
	// GET /api/accounts
	r.Handle(ToPath("accounts"), api.GetAccountsHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// GET /api/files
	r.Handle(ToPath("files"), api.GetFileHandlerFunc(base, filesService, pathsService, log)).
		Methods(http.MethodGet)

	// GET /api/deployment
	r.Handle(ToPath("deployment"), api.GetDeploymentHandlerFunc(deploymentsService)).
		Methods(http.MethodGet)

	// PUT /api/deployment/files
	r.Handle(ToPath("deployment", "files"), api.PutDeploymentFilesHandlerFunc(deploymentsService, log)).
		Methods(http.MethodPut)

	// GET /api/publish
	r.Handle(ToPath("publish"), api.PostPublishHandlerFunc(publishArgs, lister, log)).
		Methods(http.MethodGet)

	// GET /
	r.PathPrefix("/").
		Handler(web.Handler).
		Methods("GET")

	return r.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
