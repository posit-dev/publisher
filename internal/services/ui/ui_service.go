package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
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

func RouterHandlerFunc(base util.Path, stateStore *state.State, lister accounts.AccountList, log logging.Logger, eventServer *sse.Server) http.HandlerFunc {
	deploymentsService := deployments.CreateDeploymentsService(stateStore)
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

	// GET /api/configurations
	r.Handle(ToPath("configurations"), api.GetConfigurationsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/configurations
	r.Handle(ToPath("configurations"), api.PostConfigurationsHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/deployments
	r.Handle(ToPath("deployments"), api.GetDeploymentsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// GET /api/deployments/$ID
	r.Handle(ToPath("deployments", "{id}"), api.GetDeploymentHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments
	r.Handle(ToPath("deployments"), api.PostDeploymentsHandlerFunc(stateStore, base, log, lister, state.New, publish.NewFromState)).
		Methods(http.MethodPost)

	// GET /api/deployment - DEPRECATED
	r.Handle(ToPath("deployment"), api.OldGetDeploymentHandlerFunc(deploymentsService)).
		Methods(http.MethodGet)

	// PUT /api/deployment/account - DEPRECATED
	r.Handle(ToPath("deployment", "account"), api.PutDeploymentAccountHandlerFunc(lister, deploymentsService, log)).
		Methods(http.MethodPut)

	// POST /api/publish - DEPRECATED
	r.Handle(ToPath("publish"), api.PostDeploymentsHandlerFunc(stateStore, base, log, lister, state.New, publish.NewFromState)).
		Methods(http.MethodPost)

	// GET /
	r.PathPrefix("/").
		Handler(middleware.InsertPrefix(web.Handler, web.Prefix)).
		Methods("GET")

	return r.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	elements = append([]string{prefix}, elements...)
	return path.Join(elements...)
}
