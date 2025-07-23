package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

var cloudAuthClientFactory = cloud_auth.NewCloudAuthClient

func getCloudAuthBaseURL(envName string) string {
	switch envName {
	case "development", "staging":
		// Connect Cloud development environment is connected to staging auth
		return "https://staging-api.connect.posit.cloud"
	default:
		return "https://api.connect.posit.cloud"
	}
}

type connectCloudDeviceAuthResponseBody struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURIComplete string `json:"verificationURIComplete"`
	Interval                int    `json:"interval"`
}

func PostConnectCloudDeviceAuthHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		environment := req.Header.Get(connectCloudEnvironmentHeader)
		baseURL := getCloudAuthBaseURL(environment)

		client := cloudAuthClientFactory(baseURL, log, 10*time.Second)

		deviceAuthResult, err := client.CreateDeviceAuth()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		responseBody := connectCloudDeviceAuthResponseBody{
			DeviceCode:              deviceAuthResult.DeviceCode,
			UserCode:                deviceAuthResult.UserCode,
			VerificationURIComplete: deviceAuthResult.VerificationURIComplete,
			Interval:                deviceAuthResult.Interval,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(responseBody)
	}
}
