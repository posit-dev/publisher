package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
)

// PostConnectTokenUserHandlerFunc creates a handler for the POST /api/connect/token/user endpoint
// This endpoint checks if a token has been claimed and returns the user information
func PostConnectTokenUserHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var body struct {
			ServerURL  string `json:"serverUrl"`
			Token      string `json:"token"`
			PrivateKey string `json:"privateKey"`
		}
		err := dec.Decode(&body)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// Create a temporary account with the token and private key
		tempAccount := &accounts.Account{
			URL:        body.ServerURL,
			Token:      body.Token,
			PrivateKey: body.PrivateKey,
		}

		// Create a Connect client with token authentication
		client, err := connect.NewConnectClient(tempAccount, DefaultTimeout, events.NewNullEmitter(), log)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// Try to get the current user to see if the token has been claimed
		user, err := client.GetCurrentUser(log)
		if err != nil {
			// Check if it's an HTTP 401 (unauthorized) error
			isUnauthorized := false

			// Try to check if it's an HTTPError with status 401
			if httpErr, ok := err.(*http_client.HTTPError); ok {
				isUnauthorized = httpErr.Status == http.StatusUnauthorized
			}

			// Also check with the helper function
			if _, isHttpErr := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized); isHttpErr {
				isUnauthorized = true
			}

			if isUnauthorized {
				// Token is not yet claimed or is invalid
				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			InternalError(w, req, log, err)
			return
		}

		// Token is claimed, return the user information
		JsonResult(w, http.StatusOK, user)
	}
}
