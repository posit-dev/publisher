package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

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
// A connection includes a name and a validated server URL (which may be a
// truncated version of the provided server URL.)
func GetSnowflakeConnectionsHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		serverUrl := req.URL.Query().Get("serverUrl")

		// TODO: fetch conns from config files and env vars
		// TODO: test conns against server URL as in test-credentials
		response := []getSnowflakeConnectionsResponseBody{
			{"default", serverUrl},
			{"foo", serverUrl},
			{"xyzzy", serverUrl},
		}

		// if err != nil {
		// 	InternalError(w, req, log, err)
		// 	return
		// }
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
