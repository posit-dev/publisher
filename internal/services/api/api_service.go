package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"

	"github.com/rs/cors"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services/api/files"
	"github.com/rstudio/connect-client/internal/services/api/paths"
	"github.com/rstudio/connect-client/internal/services/middleware"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/web"

	"github.com/gorilla/mux"
	"github.com/r3labs/sse/v2"
)

const APIPrefix string = "api"

func NewService(
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
	eventServer *sse.Server) *Service {

	handler := RouterHandlerFunc(dir, lister, log, eventServer)

	return newHTTPService(
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
	r.Handle(ToPath("accounts"), GetAccountsHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// GET /api/accounts/{name}
	r.Handle(ToPath("accounts", "{name}"), GetAccountHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// POST /api/accounts/{name}/verify
	r.Handle(ToPath("accounts", "{name}", "verify"), PostAccountVerifyHandlerFunc(lister, log)).
		Methods(http.MethodPost)

	// GET /api/events
	r.HandleFunc(ToPath("events"), eventServer.ServeHTTP)

	// GET /api/files
	r.Handle(ToPath("files"), GetFileHandlerFunc(base, filesService, pathsService, log)).
		Methods(http.MethodGet)

	// GET /api/configurations
	r.Handle(ToPath("configurations"), GetConfigurationsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/configurations
	r.Handle(ToPath("configurations"), PostConfigurationsHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/deployments
	r.Handle(ToPath("deployments"), GetDeploymentsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments creates a new deployment record
	r.Handle(ToPath("deployments"), PostDeploymentsHandlerFunc(base, log, lister)).
		Methods(http.MethodPost)

	// GET /api/deployments/$NAME
	r.Handle(ToPath("deployments", "{name}"), GetDeploymentHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments/$NAME intiates a deployment
	r.Handle(ToPath("deployments", "{name}"), PostDeploymentHandlerFunc(base, log, lister)).
		Methods(http.MethodPost)

	// DELETE /api/deployments/$NAME
	r.Handle(ToPath("deployments", "{name}"), DeleteDeploymentHandlerFunc(base, log)).
		Methods(http.MethodDelete)

	// Handle any frontend paths that leak out (for example, on a refresh)
	// by redirecting to the SPA at "/".

	// GET /<anything>
	// Serves static files from /web/dist.
	fileHandler := middleware.InsertPrefix(web.Handler, web.Prefix)
	r.PathPrefix("/").
		Handler(middleware.ServeIndexOn404(fileHandler, "/")).
		Methods("GET")

	c := cors.AllowAll().Handler(r)
	return c.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	elements = append([]string{prefix}, elements...)
	return path.Join(elements...)
}
