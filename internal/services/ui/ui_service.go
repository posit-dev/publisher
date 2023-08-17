package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployment"

	"github.com/rstudio/platform-lib/pkg/rslog"
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
	logger rslog.Logger) *api.Service {

	handler := newUIHandler(publish, fs, lister, logger)

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
		rslog.NewDebugLogger(debug.UIRegion),
	)
}

func newUIHandler(publishArgs *cli_types.PublishArgs, afs afero.Fs, lister accounts.AccountList, log rslog.Logger) http.HandlerFunc {
	mux := http.NewServeMux()
	// /api/accounts
	mux.Handle(ToPath("accounts"), api.NewAccountsController(lister, log))
	// /api/files
	mux.Handle(ToPath("files"), api.NewFilesController(state.SourceDir, afs, log))
	// /api/deployment
	mux.Handle(ToPath("deployment"), deployment.NewDeploymentController(publishArgs.State, log))
	// /api/deployment/files
	mux.Handle(ToPath("deployment", "files"), deployment.NewFilesController(publishArgs.State, log))
	mux.Handle(ToPath("publish"), api.NewPublishController(publishArgs, lister, log))
	mux.HandleFunc("/", api.NewStaticController())
	return mux.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
