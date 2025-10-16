package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/server_type"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PostTestCredentialsRequestBody struct {
	URL      string  `json:"url"`
	ApiKey   string  `json:"apiKey"`
	Insecure bool    `json:"insecure"`
	Timeout  float32 `json:"timeout"`
}

type PostTestCredentialsResponseBody struct {
	User *connect.User `json:"user"`
	URL  string        `json:"url"`

	ServerType server_type.ServerType `json:"serverType"`

	Error *types.AgentError `json:"error"`
}

var connectClientFactory = connect.NewConnectClient

func PostTestCredentialsHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b PostTestCredentialsRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		serverType, err := server_type.ServerTypeFromURL(b.URL)
		if err != nil {
			// unparseable URL
			BadRequest(w, req, log, err)
			return
		}

		var user *connect.User
		var lastTestError error

		// Create a tester function that attempts authentication for each URL
		tester := func(urlToTest string) error {
			acct := &accounts.Account{
				ServerType: serverType,
				URL:        urlToTest,
				Insecure:   b.Insecure,
				ApiKey:     b.ApiKey,
			}

			timeout := time.Duration(max(b.Timeout, 30) * 1e9)
			client, err := connectClientFactory(acct, timeout, nil, log)
			if err != nil {
				return err
			}

			user, lastTestError = client.TestAuthentication(log)
			return lastTestError
		}

		// Use the reusable URL discovery function
		discoveredURL, err := util.DiscoverServerURL(b.URL, tester)
		if err == nil {
			// If we succeeded, pass back what URL succeeded
			response := &PostTestCredentialsResponseBody{
				User:       user,
				Error:      nil,
				URL:        discoveredURL,
				ServerType: serverType,
			}
			w.Header().Set("content-type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}

		// failure after all attempts, return last error
		response := &PostTestCredentialsResponseBody{
			User:       user,
			Error:      types.AsAgentError(lastTestError),
			URL:        b.URL, // pass back original URL
			ServerType: serverType,
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
