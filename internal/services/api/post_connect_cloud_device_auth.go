package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/clients/cloud_auth"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

var cloudAuthClientFactory = cloud_auth.NewCloudAuthClient

type connectCloudDeviceAuthResponseBody struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURIComplete string `json:"verificationURIComplete"`
	Interval                int    `json:"interval"`
}

func PostConnectCloudDeviceAuthHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		environment := types.CloudEnvironment(req.Header.Get(connectCloudEnvironmentHeader))
		client := cloudAuthClientFactory(environment, log, 10*time.Second)

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
