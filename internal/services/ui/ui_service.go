package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/url"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/deployments"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/web"

	"github.com/gorilla/mux"
	"github.com/r3labs/sse/v2"
)

const APIPrefix string = "api"

func NewUIService(
	fragment string,
	interactive bool,
	openBrowserAt string,
	theme string,
	listen string,
	accessLog bool,
	tlsKeyFile string,
	tlsCertFile string,
	dir util.Path,
	stateStore *state.State,
	lister accounts.AccountList,
	log logging.Logger,
	eventServer *sse.Server) *api.Service {

	handler := RouterHandlerFunc(dir, stateStore, lister, log, eventServer)

	return api.NewService(
		stateStore,
		handler,
		listen,
		fragment,
		tlsKeyFile,
		tlsCertFile,
		interactive,
		openBrowserAt,
		accessLog,
		log,
	)
}

func RouterHandlerFunc(base util.Path, s *state.State, lister accounts.AccountList, log logging.Logger, eventServer *sse.Server) http.HandlerFunc {
	deploymentsService := deployments.CreateDeploymentsService(s)
	filesService := files.CreateFilesService(base, log)
	pathsService := paths.CreatePathsService(base, log)

	r := mux.NewRouter()
	// GET /api/accounts
	r.Handle(ToPath("accounts"), api.GetAccountsHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// GET /api/events
	r.HandleFunc(ToPath("events"), eventServer.ServeHTTP)

	// GET /api/files
	r.Handle(ToPath("files"), api.GetFileHandlerFunc(base, filesService, pathsService, log)).
		Methods(http.MethodGet)

	// GET /api/deployment
	r.Handle(ToPath("deployment"), api.GetDeploymentHandlerFunc(deploymentsService)).
		Methods(http.MethodGet)

	// PUT /api/deployment/account
	r.Handle(ToPath("deployment", "account"), api.PutDeploymentAccountHandlerFunc(lister, deploymentsService, log)).
		Methods(http.MethodPut)

	// POST /api/publish
	r.Handle(ToPath("publish"), api.PostPublishHandlerFunc(base, log, lister)).
		Methods(http.MethodPost)

	// GET /
	r.PathPrefix("/").
		Handler(middleware.InsertPrefix(web.Handler, web.Prefix)).
		Methods("GET")

	return r.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	path, _ := url.JoinPath(prefix, elements...)
	return path
}
