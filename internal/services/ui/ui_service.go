package ui

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/services/middleware"
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
	lister accounts.AccountList,
	log logging.Logger,
	eventServer *sse.Server) *api.Service {

	handler := RouterHandlerFunc(dir, lister, log, eventServer)

	return api.NewService(
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

func RouterHandlerFunc(base util.Path, lister accounts.AccountList, log logging.Logger, eventServer *sse.Server) http.HandlerFunc {
	filesService := files.CreateFilesService(base, log)
	pathsService := paths.CreatePathsService(base, log)

	r := mux.NewRouter()
	// GET /api/accounts
	r.Handle(ToPath("accounts"), api.GetAccountsHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// GET /api/accounts/{name}
	r.Handle(ToPath("accounts", "{name}"), api.GetAccountHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// POST /api/accounts/{name}/verify
	r.Handle(ToPath("accounts", "{name}", "verify"), api.PostAccountVerifyHandlerFunc(lister, log)).
		Methods(http.MethodPost)

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
	r.Handle(ToPath("deployments"), api.PostDeploymentsHandlerFunc(base, log, lister)).
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
