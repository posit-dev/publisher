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

const cloudAuthClientID = "posit_publisher"

type connectCloudDeviceAuthRequestBody struct {
	BaseURL string `json:"baseURL"`
}

type connectCloudDeviceAuthResponseBody struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationURIComplete string `json:"verificationURIComplete"`
	Interval                int    `json:"interval"`
}

func PostConnectCloudDeviceAuthHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b connectCloudDeviceAuthRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		client := cloudAuthClientFactory(b.BaseURL, log, 10*time.Second)

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
