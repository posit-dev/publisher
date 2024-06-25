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
)

type PostTestCredentialsRequestBody struct {
	URL      string  `json:"url"`
	ApiKey   string  `json:"apiKey"`
	Insecure bool    `json:"insecure"`
	Timeout  float32 `json:"timeout"`
}

type PostTestCredentialsResponseBody struct {
	User  *connect.User     `json:"user"`
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
		acct := &accounts.Account{
			ServerType: accounts.ServerTypeConnect,
			AuthType:   accounts.AuthTypeAPIKey,
			URL:        b.URL,
			Insecure:   b.Insecure,
			ApiKey:     b.ApiKey,
		}

		timeout := time.Duration(max(b.Timeout, 30) * 1e9)
		client, err := clientFactory(acct, timeout, nil, log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		user, err := client.TestAuthentication(log)

		response := &PostTestCredentialsResponseBody{
			User:  user,
			Error: types.AsAgentError(err),
		}
		w.Header().Set("content-type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}
}
