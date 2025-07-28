package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type connectCloudAccountsBodyAccount struct {
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

		// implicitly creates a user if it doesn't exist
		_, err := client.GetCurrentUser()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		accountsResponse, err := client.GetAccounts()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		accounts := make([]connectCloudAccountsBodyAccount, 0, len(accountsResponse.Data))
		for _, account := range accountsResponse.Data {
			accounts = append(accounts, connectCloudAccountsBodyAccount{
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
