package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
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
	User  *connect.User     `json:"user"`
	URL   string            `json:"url"`
	Error *types.AgentError `json:"error"`
}

var clientFactory = connect.NewConnectClient

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

		// create a list of URLs to attempt
		possibleURLs, err := util.GetListOfPossibleURLs(b.URL)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		// walk the possible URL list backwards (it has the full path first)
		var urlToBeTested string
		var lastTestError error
		var user *connect.User

		for i := len(possibleURLs) - 1; i >= 0; i-- {
			urlToBeTested = possibleURLs[i]

			acct := &accounts.Account{
				ServerType: accounts.ServerTypeConnect,
				AuthType:   accounts.AuthTypeAPIKey,
				URL:        urlToBeTested,
				Insecure:   b.Insecure,
				ApiKey:     b.ApiKey,
			}

			timeout := time.Duration(max(b.Timeout, 30) * 1e9)
			client, err := clientFactory(acct, timeout, nil, log)
			if err != nil {
				InternalError(w, req, log, err)
				return
			}

			user, lastTestError = client.TestAuthentication(log)
			if lastTestError == nil {
				// If we succeeded, pass back what URL succeeded
				response := &PostTestCredentialsResponseBody{
					User:  user,
					Error: nil,
					URL:   urlToBeTested,
				}
				w.Header().Set("content-type", "application/json")
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(response)
				return
			}
		}

		// failure after all attempts, return last error
		response := &PostTestCredentialsResponseBody{
			User:  user,
			Error: types.AsAgentError(lastTestError),
			URL:   b.URL, // pass back original URL
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
