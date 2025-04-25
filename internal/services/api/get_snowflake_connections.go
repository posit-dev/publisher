package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/logging"
)

// GetSnowflakeConnectionsHandlerFunc responds with a list of Snowflake
// connection names, derived from configuratio files and environment variables.
func GetSnowflakeConnectionsHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		response := []string{
			"default",
			"foo",
			"bar baz",
		}

		// if err != nil {
		// 	InternalError(w, req, log, err)
		// 	return
		// }
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
