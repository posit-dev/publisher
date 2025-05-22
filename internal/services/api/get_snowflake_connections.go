package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type getSnowflakeConnectionsResponseBody struct {
	Name      string `json:"name"`
	ServerUrl string `json:"serverUrl"`
}

// GetSnowflakeConnectionsHandlerFunc responds with a list of Snowflake
// connections, derived from configuration files and environment variables,
// that can successfully authenticate to `serverUrl`.
//
// A connection includes a name and a validated server URL.
func GetSnowflakeConnectionsHandlerFunc(log logging.Logger, connections snowflake.Connections) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		serverUrl := req.URL.Query().Get("serverUrl")

		serverType, err := accounts.ServerTypeFromURL(serverUrl)
		if err != nil {
			// unparseable URL
			BadRequest(w, req, log, err)
			return
		}

		possibleURLs, err := util.GetListOfPossibleURLs(serverUrl)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		conns, err := connections.List()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		response := []getSnowflakeConnectionsResponseBody{}

		// TODO: parallelize this?
		for name := range conns {
			// TODO: with what we know about Snowflake deployments,
			// can we simplify this? e.g. just strip the path and
			// test the hostname.
			for _, url := range possibleURLs {
				acct := &accounts.Account{
					ServerType:          serverType,
					URL:                 url,
					Insecure:            false, // TODO: do we need to support insecure snowflake URLs?
					SnowflakeConnection: name,
				}

				timeout := time.Second * 30
				client, err := clientFactory(acct, timeout, nil, log)
				if err != nil {
					InternalError(w, req, log, err)
					return
				}

				if _, err = client.TestAuthentication(log); err == nil {
					// If we succeeded, pass back what URL succeeded
					response = append(response, getSnowflakeConnectionsResponseBody{
						Name:      name,
						ServerUrl: url,
					})
					// don't keep testing other URLs
					break
				}
			}
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
