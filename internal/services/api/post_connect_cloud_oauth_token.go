package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/cloud"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type connectCloudOAuthTokenRequestBody struct {
	DeviceCode string `json:"deviceCode"`
}

type connectCloudOAuthTokenResponseBody struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
}

func PostConnectCloudOAuthTokenHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		baseURL := req.Header.Get(cloudAuthBaseURLHeader)
		if baseURL == "" {
			BadRequest(w, req, log, fmt.Errorf("%s header is required", cloudAuthBaseURLHeader))
			return
		}

		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b connectCloudOAuthTokenRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		environment := cloud.GetCloudEnvironment(req.Header.Get(connectCloudEnvironmentHeader))
		client := cloudAuthClientFactory(environment, log, 10*time.Second)

		tokenRequest := cloud_auth.TokenRequest{
			GrantType:  "urn:ietf:params:oauth:grant-type:device_code",
			DeviceCode: b.DeviceCode,
		}
		tokenResponse, err := client.ExchangeToken(tokenRequest)
		if err != nil {
			aerr, isBadRequest := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusBadRequest)
			if isBadRequest {
				deviceAuthErr := types.APIErrorDeviceAuthFromAgentError(*aerr, log)
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
