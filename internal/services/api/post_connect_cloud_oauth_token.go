package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/types"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

type connectCloudOAuthTokenRequestBody struct {
	BaseURL    string `json:"baseURL"`
	DeviceCode string `json:"deviceCode"`
}

type connectCloudOAuthTokenResponseBody struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
}

func PostConnectCloudOAuthTokenHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b connectCloudOAuthTokenRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		client := cloudAuthClientFactory(b.BaseURL, log, 10*time.Second)

		tokenRequest := cloud_auth.TokenRequest{
			GrantType:  "device_code",
			DeviceCode: b.DeviceCode,
			ClientID:   cloudAuthClientID,
		}
		tokenResponse, err := client.ExchangeToken(tokenRequest)
		if err != nil {
			aerr, isBadRequest := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusBadRequest)
			if isBadRequest {
				deviceAuthErr := types.APIErrorDeviceAuthFromAgentError(*aerr)
				deviceAuthErr.JSONResponse(w)
				return
			}
			InternalError(w, req, log, err)
			return
		}

		apiResponse := connectCloudOAuthTokenResponseBody{
			AccessToken:  tokenResponse.AccessToken,
			RefreshToken: tokenResponse.RefreshToken,
			ExpiresIn:    tokenResponse.ExpiresIn,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(apiResponse)
	}
}
