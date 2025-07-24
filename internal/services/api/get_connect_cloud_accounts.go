package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"

	"github.com/posit-dev/publisher/internal/logging"
)

type connectCloudAccountsResponseItem struct {
	Name                string `json:"name"`
	ID                  string `json:"id"`
	PermissionToPublish bool   `json:"permissionToPublish"`
}

var connectCloudClientFactory = connect_cloud.NewConnectCloudClientWithAuth

const connectCloudBaseURLHeader = "Connect-Cloud-Base-Url"

// type connectCloudAccountsBody struct {
// 	Accounts []connectCloudAccountsBodyAccount `json:"accounts"`
// }

func GetConnectCloudAccountsFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		baseURL := req.Header.Get(connectCloudBaseURLHeader)
		if baseURL == "" {
			BadRequest(w, req, log, fmt.Errorf("%s header is required", connectCloudBaseURLHeader))
			return
		}
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

		accounts := make([]connectCloudAccountsResponseItem, 0, len(accountsResponse.Data))
		for _, account := range accountsResponse.Data {
			accounts = append(accounts, connectCloudAccountsResponseItem{
				ID:                  account.ID,
				Name:                account.Name,
				PermissionToPublish: slices.Contains(account.Permissions, "content:create"),
			})
		}

		// apiResponse := connectCloudAccountsBody{
		// 	Accounts: accounts,
		// }
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(accounts)
	}
}
