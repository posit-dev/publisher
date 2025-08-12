package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/posit-dev/publisher/internal/api_client/auth/tokenutil"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
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

		// Create Connect client for the specified server
		// Create an HTTP client for API calls
		httpClient := http_client.NewBasicHTTPClient(body.ServerURL, DefaultTimeout)

		// Send the token and public key to the server to get a claim URL
		tokenRequest := map[string]interface{}{
			"token":      tokenID,
			"public_key": publicKey,
			"user_id":    0, // 0 means current user
		}

		var tokenResponse map[string]interface{}
		err = httpClient.Post("/__api__/tokens", tokenRequest, &tokenResponse, log)
		if err != nil {
			if _, isHttpErr := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized); isHttpErr {
				// Return a simple unauthorized response for invalid credentials
				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			InternalError(w, req, log, err)
			return
		}

		// Extract the claim URL from the response
		claimURL, ok := tokenResponse["token_claim_url"].(string)
		if !ok {
			InternalError(w, req, log, types.NewAgentError(types.ErrorUnknown, nil, nil))
			return
		}

		// Return the token, claim URL, and private key to the client
		response := PostConnectTokenResponse{
			Token:      tokenID,
			ClaimURL:   claimURL,
			PrivateKey: privateKey,
		}

		JsonResult(w, http.StatusCreated, response)
	}
}
