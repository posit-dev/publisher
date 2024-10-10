package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/services/api/files"
	"github.com/posit-dev/publisher/internal/services/api/paths"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/rs/cors"

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
	dir util.AbsolutePath,
	lister accounts.AccountList,
	log logging.Logger,
	eventServer *sse.Server,
	emitter events.Emitter) *Service {

	handler := RouterHandlerFunc(dir, lister, log, eventServer, emitter)

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

func RouterHandlerFunc(base util.AbsolutePath, lister accounts.AccountList, log logging.Logger, eventServer *sse.Server, emitter events.Emitter) http.HandlerFunc {
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

	// POST /api/entrypoints
	r.Handle(ToPath("entrypoints"), GetEntrypointsHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// POST /api/inspect
	r.Handle(ToPath("inspect"), PostInspectHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/credentials
	r.Handle(ToPath("credentials"), GetCredentialsHandlerFunc(log)).
		Methods(http.MethodGet)

	// GET /api/credentials/$GUID
	r.Handle(ToPath("credentials", "{guid}"), GetCredentialHandlerFunc(log)).
		Methods(http.MethodGet)

	// POST /api/credentials
	r.Handle(ToPath("credentials"), PostCredentialFuncHandler(log)).
		Methods(http.MethodPost)

	// DELETE /api/credentials
	r.Handle(ToPath("credentials", "{guid}"), DeleteCredentialHandlerFunc(log)).
		Methods(http.MethodDelete)

	// POST /api/test-credentials
	r.Handle(ToPath("test-credentials"), PostTestCredentialsHandlerFunc(log)).
		Methods(http.MethodPost)

	// GET /api/configurations
	r.Handle(ToPath("configurations"), GetConfigurationsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// GET /api/configurations/$NAME
	r.Handle(ToPath("configurations", "{name}"), GetConfigurationHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// PUT /api/configurations/$NAME
	r.Handle(ToPath("configurations", "{name}"), PutConfigurationHandlerFunc(base, log)).
		Methods(http.MethodPut)

	// DELETE /api/configurations/$NAME
	r.Handle(ToPath("configurations", "{name}"), DeleteConfigurationHandlerFunc(base, log)).
		Methods(http.MethodDelete)

	// GET /api/configurations/$NAME/files
	r.Handle(ToPath("configurations", "{name}", "files"), GetConfigFilesHandlerFunc(base, filesService, log)).
		Methods(http.MethodGet)

	// POST /api/configurations/$NAME/files
	r.Handle(ToPath("configurations", "{name}", "files"), PostConfigFilesHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/configurations/$NAME/secrets
	r.Handle(ToPath("configurations", "{name}", "secrets"), GetConfigSecretsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/configurations/$NAME/secrets
	r.Handle(ToPath("configurations", "{name}", "secrets"), PostConfigSecretsHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/configurations/$NAME/packages/python
	r.Handle(ToPath("configurations", "{name}", "packages", "python"), NewGetConfigPythonPackagesHandler(base, log)).
		Methods(http.MethodGet)

	// GET /api/configurations/$NAME/packages/r
	r.Handle(ToPath("configurations", "{name}", "packages", "r"), NewGetConfigRPackagesHandler(base, log)).
		Methods(http.MethodGet)

	// GET /api/deployments
	r.Handle(ToPath("deployments"), GetDeploymentsHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments creates a new deployment record
	r.Handle(ToPath("deployments"), PostDeploymentsHandlerFunc(base, log, lister)).
		Methods(http.MethodPost)

	// PATCH /api/deployments/$NAME updates a deployment record
	r.Handle(ToPath("deployments", "{name}"), PatchDeploymentHandlerFunc(base, log)).
		Methods(http.MethodPatch)

	// GET /api/deployments/$NAME
	r.Handle(ToPath("deployments", "{name}"), GetDeploymentHandlerFunc(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments/$NAME intiates a deployment
	r.Handle(ToPath("deployments", "{name}"), PostDeploymentHandlerFunc(base, log, lister, emitter)).
		Methods(http.MethodPost)

	// DELETE /api/deployments/$NAME
	r.Handle(ToPath("deployments", "{name}"), DeleteDeploymentHandlerFunc(base, log)).
		Methods(http.MethodDelete)

	// POST /api/packages/python/scan
	r.Handle(ToPath("packages", "python", "scan"), NewPostPackagesPythonScanHandler(base, log)).
		Methods(http.MethodPost)

	// POST /api/packages/r/scan
	r.Handle(ToPath("packages", "r", "scan"), NewPostPackagesRScanHandler(base, log)).
		Methods(http.MethodPost)

	c := cors.AllowAll().Handler(r)
	return c.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	elements = append([]string{prefix}, elements...)
	return path.Join(elements...)
}
