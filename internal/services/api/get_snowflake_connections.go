package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/logging"
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
func GetSnowflakeConnectionsHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		serverUrl := req.URL.Query().Get("serverUrl")

		conns, err := snowflake.GetConnections()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		response := []getSnowflakeConnectionsResponseBody{}

		// TODO: parallelize this?
		for name := range conns {
			acct := &accounts.Account{
				ServerType:          accounts.ServerTypeConnect,
				URL:                 serverUrl,
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
					Name: name,
					// For now, we are just validating the URL that was passed in.
					// Could normalize it?
					ServerUrl: serverUrl,
				})
			}
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
