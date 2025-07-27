package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/posit-dev/publisher/internal/logging"
)

type connectCloudAccountsResponseItem struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	DisplayName         string `json:"displayName"`
	PermissionToPublish bool   `json:"permissionToPublish"`
}

var connectCloudClientFactory = connect_cloud.NewConnectCloudClientWithAuth

const connectCloudEnvironmentHeader = "Connect-Cloud-Environment"

func GetConnectCloudAccountsFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		environment := types.CloudEnvironment(req.Header.Get(connectCloudEnvironmentHeader))
		authorization := req.Header.Get("Authorization")

		client := connectCloudClientFactory(environment, log, 10*time.Second, authorization)

		_, err := client.GetCurrentUser()
		if err != nil {
			aerr, isUnauthorized := http_client.IsHTTPAgentErrorStatusOf(err, http.StatusUnauthorized)
			if isUnauthorized {
				errorType, ok := aerr.Data["error_type"].(string)
				if ok && errorType == "no_user_for_lucid_user" {
					// We have a user for the auth service, but not for Connect Cloud.
					err = client.CreateUser()
					if err != nil {
						InternalError(w, req, log, aerr)
						return
					}
				} else {
					InternalError(w, req, log, aerr)
					return
				}
			} else {
				InternalError(w, req, log, aerr)
				return
			}
		}

		accountsResponse, err := client.GetAccounts()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		accounts := make([]connectCloudAccountsResponseItem, 0, len(accountsResponse.Data))
		for _, account := range accountsResponse.Data {
			accounts = append(accounts, connectCloudAccountsResponseItem{
				ID:                  account.ID,
				Name:                account.Name,
				DisplayName:         account.DisplayName,
				PermissionToPublish: slices.Contains(account.Permissions, "content:create"),
			})
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(accounts)
	}
}
