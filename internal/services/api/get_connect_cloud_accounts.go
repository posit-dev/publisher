package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"net/http"
	"time"

	"github.com/posit-dev/publisher/internal/logging"
)

type connectCloudAccountsBodyAccount struct {
	Name                string `json:"name"`
	ID                  string `json:"id"`
	PermissionToPublish bool   `json:"permissionToPublish"`
}

var connectCloudClientFactory = connect_cloud.NewConnectCloudClientWithAuth

const connectCloudBaseURLHeader = "Connect-Cloud-Base-Url"

type connectCloudAccountsBody struct {
	Accounts []connectCloudAccountsBodyAccount `json:"accounts"`
}

func GetConnectCloudAccountsFunc(log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		baseURL := req.Header.Get(connectCloudBaseURLHeader)
		if baseURL == "" {
			BadRequest(w, req, log, fmt.Errorf("%s header is required", connectCloudBaseURLHeader))
			return
		}
		authorization := req.Header.Get("Authorization")

		client := connectCloudClientFactory(baseURL, log, 10*time.Second, authorization)

		currentUser, err := client.GetCurrentUser()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}

		accounts := make([]connectCloudAccountsBodyAccount, 0, len(currentUser.AccountRoles))
		for accountID, accountRole := range currentUser.AccountRoles {
			role := accountRole.Role
			accounts = append(accounts, connectCloudAccountsBodyAccount{
				ID:                  accountID,
				Name:                accountRole.Account.Name,
				PermissionToPublish: role == "owner" || role == "admin" || accountRole.Role == "publisher",
			})
		}

		apiResponse := connectCloudAccountsBody{
			Accounts: accounts,
		}
		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(apiResponse)
	}
}
