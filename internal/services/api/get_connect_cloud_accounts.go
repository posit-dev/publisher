package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"net/http"
	"slices"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

type connectCloudAccountsBodyAccount struct {
	Name                string `json:"name"`
	ID                  string `json:"id"`
	PermissionToPublish bool   `json:"permissionToPublish"`
}

var connectCloudClientFactory = connect_cloud.NewConnectCloudClientWithAuth

const connectCloudEnvironmentHeader = "Connect-Cloud-Environment"

// const connectCloudBaseURLHeader = "Connect-Cloud-Base-Url"
func getConnectCloudBaseURL(envName string) string {
	switch envName {
	case "development":
		return "https://api.connect.posit.cloud"
	case "staging":
		return "https://staging-api.connect.posit.cloud"
	default:
		return "https://api.connect.posit.cloud"
	}
}

type connectCloudAccountsBody struct {
	Accounts []connectCloudAccountsBodyAccount `json:"accounts"`
}

func GetConnectCloudAccountsFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		environment := req.Header.Get(connectCloudEnvironmentHeader)
		baseURL := getConnectCloudBaseURL(environment)
		authorization := req.Header.Get("Authorization")

		client := connectCloudClientFactory(baseURL, log, 10*time.Second, authorization)

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
				PermissionToPublish: slices.Contains(account.Permissions, "content:create"),
			})
		}

		apiResponse := connectCloudAccountsBody{
			Accounts: accounts,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(apiResponse)
	}
}
