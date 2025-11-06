package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/api_client/auth/tokenutil"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PostConnectTokenRequest struct {
	ServerURL string `json:"serverUrl"`
}

type PostConnectTokenResponse struct {
	Token     string `json:"token"`
	ClaimURL  string `json:"claimUrl"`
	PublicKey string `json:"publicKey,omitempty"`
	// PrivateKey is only returned to the client and never sent to the server
	PrivateKey string `json:"privateKey"`
	// ServerURL is the discovered/validated server URL (may differ from the provided URL)
	ServerURL string `json:"serverUrl,omitempty"`
}

// PostConnectTokenHandlerFunc creates a handler for the POST /api/connect/token endpoint
// This endpoint generates a new token for Connect authentication and returns the token
// along with a claim URL for browser-based authentication
func PostConnectTokenHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var body PostConnectTokenRequest
		err := dec.Decode(&body)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// Generate a new token with RSA key pair
		tokenID, publicKey, privateKey, err := tokenutil.GenerateToken()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		// Create a tester function that attempts to create a token for each URL
		var tokenResponse map[string]interface{}
		var claimURL string

		tester := func(urlToTest string) error {
			// Create an HTTP client for API calls with the test URL
			httpClient := http_client.NewBasicHTTPClient(urlToTest, DefaultTimeout)

			// Send the token and public key to the server to get a claim URL
			tokenRequest := map[string]interface{}{
				"token":      tokenID,
				"public_key": publicKey,
				"user_id":    0, // 0 means current user
			}

			err := httpClient.Post("/__api__/tokens", tokenRequest, &tokenResponse, log)
			if err != nil {
				return err
			}

			// Extract the claim URL from the response
			var ok bool
			claimURL, ok = tokenResponse["token_claim_url"].(string)
			if !ok {
				return types.NewAgentError(types.ErrorUnknown, nil, nil)
			}

			return nil
		}

		// Use the reusable URL discovery function
		discoveredURL, err := util.DiscoverServerURL(body.ServerURL, tester)
		if err != nil {
			if _, isHttpErr := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized); isHttpErr {
				// Return a simple unauthorized response for invalid credentials
				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			InternalError(w, req, log, err)
			return
		}

		// Log the discovered URL if different from provided
		if discoveredURL != body.ServerURL {
			log.Info("Using discovered server URL", "provided", body.ServerURL, "discovered", discoveredURL)
		}

		// Return the token, claim URL, private key, and discovered URL to the client
		response := PostConnectTokenResponse{
			Token:      tokenID,
			ClaimURL:   claimURL,
			PrivateKey: privateKey,
			ServerURL:  discoveredURL,
		}

		JsonResult(w, http.StatusCreated, response)
	}
}
