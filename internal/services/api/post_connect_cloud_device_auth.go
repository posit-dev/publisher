package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"github.com/posit-dev/publisher/internal/clients/cloud_auth"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

var cloudAuthClientFactory = cloud_auth.NewCloudAuthClient

const cloudAuthBaseURLHeader = "Cloud-Auth-Base-Url"
const cloudAuthClientID = "posit_publisher"

type connectCloudDeviceAuthResponseBody struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURIComplete string `json:"verificationURIComplete"`
	Interval                int    `json:"interval"`
}

func PostConnectCloudDeviceAuthHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		baseURL := req.Header.Get(cloudAuthBaseURLHeader)
		if baseURL == "" {
			BadRequest(w, req, log, fmt.Errorf("%s header is required", cloudAuthBaseURLHeader))
			return
		}

		client := cloudAuthClientFactory(baseURL, log, 10*time.Second)

		deviceAuthRequest := cloud_auth.DeviceAuthRequest{
			ClientID: cloudAuthClientID,
			Scope:    "vivid",
		}
		deviceAuthResult, err := client.CreateDeviceAuth(deviceAuthRequest)
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
