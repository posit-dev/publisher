package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/credentials"
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

const DefaultTimeout = 30 * time.Second

func NewService(
	fragment string,
	listen string,
	accessLog bool,
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
		accessLog,
		log,
	)
}

func RouterHandlerFunc(base util.AbsolutePath, lister accounts.AccountList, log logging.Logger, eventServer *sse.Server, emitter events.Emitter) http.HandlerFunc {
	filesService := files.CreateFilesService(base, log)
	pathsService := paths.CreatePathsService(base, log)

	r := mux.NewRouter()
	// GET /api/accounts/{name}/server-settings
	r.Handle(ToPath("accounts", "{name}", "server-settings"), GetServerSettingsHandlerFunc(lister, log)).
		Methods(http.MethodGet)

	// GET /api/events
	r.HandleFunc(ToPath("events"), eventServer.ServeHTTP)

	// GET /api/files
	r.Handle(ToPath("files"), GetFileHandlerFunc(base, filesService, pathsService, log)).
		Methods(http.MethodGet)

	// POST /api/inspect
	r.Handle(ToPath("inspect"), PostInspectHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/credentials
	r.Handle(ToPath("credentials"), GetCredentialsHandlerFunc(log, func(log logging.Logger) (credentials.CredentialsService, error) {
		return credentials.NewCredentialsService(log)
	})).Methods(http.MethodGet)

	// POST /api/credentials
	r.Handle(ToPath("credentials"), PostCredentialFuncHandler(log)).
		Methods(http.MethodPost)

	// DELETE /api/credentials/$GUID
	r.Handle(ToPath("credentials", "{guid}"), DeleteCredentialHandlerFunc(log)).
		Methods(http.MethodDelete)

	// DELETE /api/credentials
	r.Handle(ToPath("credentials"), ResetCredentialsHandlerFunc(log, func(log logging.Logger) (credentials.CredentialsService, error) {
		return credentials.NewCredentialsService(log)
	})).Methods(http.MethodDelete)

	// POST /api/test-credentials
	r.Handle(ToPath("test-credentials"), PostTestCredentialsHandlerFunc(log)).
		Methods(http.MethodPost)

	// POST /api/connect/open-content
	r.Handle(ToPath("connect", "open-content"), PostOpenConnectContentHandlerFunc(lister, log, emitter)).
		Methods(http.MethodPost)

	// GET /api/configurations/$NAME/files
	r.Handle(ToPath("configurations", "{name}", "files"), GetConfigFilesHandlerFunc(base, filesService, log)).
		Methods(http.MethodGet)


	// POST /api/configurations/$NAME/secrets
	r.Handle(ToPath("configurations", "{name}", "secrets"), PostConfigSecretsHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/configurations/$NAME/packages/r
	r.Handle(ToPath("configurations", "{name}", "packages", "r"), NewGetConfigRPackagesHandler(base, log)).
		Methods(http.MethodGet)

	// POST /api/deployments/$NAME initiates a deployment
	r.Handle(ToPath("deployments", "{name}"), PostDeploymentHandlerFunc(base, log, lister, emitter)).
		Methods(http.MethodPost)

	// POST /api/deployments/$NAME/cancel/$LOCALID cancels a deployment
	r.Handle(ToPath("deployments", "{name}", "cancel", "{localid}"), PostDeploymentCancelHandlerFunc(base, log)).
		Methods(http.MethodPost)

	// GET /api/deployments/$NAME/environment
	r.Handle(ToPath("deployments", "{name}", "environment"), GetDeploymentEnvironmentHandlerFunc(base, log, lister)).
		Methods(http.MethodGet)

	// POST /api/packages/python/scan
	r.Handle(ToPath("packages", "python", "scan"), NewPostPackagesPythonScanHandler(base, log)).
		Methods(http.MethodPost)

	// GET /api/snowflake-connections
	r.Handle(ToPath("snowflake-connections"), GetSnowflakeConnectionsHandlerFunc(log, snowflake.NewConnections())).
		Methods(http.MethodGet)

	// POST /api/connect-cloud/device-auth
	r.Handle(ToPath("connect-cloud", "device-auth"), PostConnectCloudDeviceAuthHandlerFunc(log)).
		Methods(http.MethodPost)

	// POST /api/connect-cloud/oauth/token
	r.Handle(ToPath("connect-cloud", "oauth", "token"), PostConnectCloudOAuthTokenHandlerFunc(log)).
		Methods(http.MethodPost)

	// POST /api/connect/token - Generate a new token for Connect authentication
	r.Handle(ToPath("connect", "token"), PostConnectTokenHandlerFunc(log)).
		Methods(http.MethodPost)

	// POST /api/connect/token/user - Check if a token has been claimed and get user info
	r.Handle(ToPath("connect", "token", "user"), PostConnectTokenUserHandlerFunc(log)).
		Methods(http.MethodPost)

	// GET /api/connect-cloud/accounts
	r.Handle(ToPath("connect-cloud", "accounts"), GetConnectCloudAccountsFunc(log)).
		Methods(http.MethodGet)

	c := cors.AllowAll().Handler(r)
	return c.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	elements = append([]string{prefix}, elements...)
	return path.Join(elements...)
}
