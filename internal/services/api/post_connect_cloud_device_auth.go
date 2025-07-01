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

type ConnectCloudDeviceAuthRequestBody struct {
	BaseURL string `json:"baseURL"`
}

func PostConnectCloudDeviceAuthHandlerFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		var b ConnectCloudDeviceAuthRequestBody
		err := dec.Decode(&b)
		if err != nil {
			BadRequest(w, req, log, err)
			return
		}

		client := cloudAuthClientFactory(b.BaseURL, log, 10*time.Second)

		deviceAuthRequest := cloud_auth.DeviceAuthRequest{
			ClientID: "posit_publisher",
			Scope:    "vivid",
		}
		deviceAuthResult, err := client.CreateDeviceAuth(deviceAuthRequest)

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(deviceAuthResult)
	}
}
