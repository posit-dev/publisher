package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"path"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
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
	r := mux.NewRouter()

	// GET /api/events
	r.HandleFunc(ToPath("events"), eventServer.ServeHTTP)

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

	c := cors.AllowAll().Handler(r)
	return c.ServeHTTP
}

func ToPath(elements ...string) string {
	prefix := "/" + APIPrefix
	elements = append([]string{prefix}, elements...)
	return path.Join(elements...)
}
