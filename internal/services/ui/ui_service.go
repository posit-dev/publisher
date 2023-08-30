package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"

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
	log logging.Logger) *api.Service {

	handler := newUIHandler(fs, publish, lister, log)

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
		log,
	)
}

func newUIHandler(afs afero.Fs, publishArgs *cli_types.PublishArgs, lister accounts.AccountList, log logging.Logger) http.HandlerFunc {

	deployment := publishArgs.State
	base := deployment.SourceDir

	deploymentsService := deployments.CreateDeploymentsService(deployment)
	filesService := files.CreateFilesService(base, afs, log)
	pathsService := paths.CreatePathsService(base, afs, log)

	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.GetAccountsHandlerFunc(lister, log))
	// /api/files
	mux.Handle(ToPath("files"), api.GetFileHandlerFunc(base, filesService, pathsService, log))
	// /api/deployment
	mux.Handle(ToPath("deployment"), api.GetDeploymentHandlerFunc(deploymentsService))
	// /api/deployment/files
	mux.Handle(ToPath("deployment", "files"), api.PutDeploymentFilesHandlerFunc(deploymentsService, log))
	mux.Handle(ToPath("publish"), api.PostPublishHandlerFunc(publishArgs, lister, log))
	mux.HandleFunc("/", api.NewStaticController())

	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
