package api

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
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

const connectCloudBaseURLHeader = "Cloud-Auth-Base-Url"

type connectCloudAccountsBody struct {
	Accounts []connectCloudAccountsBodyAccount `json:"accounts"`
}

func GetConnectCloudAccountsFunc(log logging.Logger) http.HandlerFunc {
	fmt.Println("asdf asdf asdf")
	return func(w http.ResponseWriter, req *http.Request) {
		fmt.Println("start!")
		baseURL := req.Header.Get(connectCloudBaseURLHeader)
		if baseURL == "" {
			BadRequest(w, req, log, errors.New("Cloud-Auth-Base-Url header is required"))
			return
		}
		authorization := req.Header.Get("Authorization")

		client := connect_cloud.NewConnectCloudClientWithAuth(baseURL, log, 10*time.Second, authorization)
		fmt.Println("calling vivid-api")

		currentUser, err := client.GetCurrentUser()
		if err != nil {
			fmt.Println("whee")
			InternalError(w, req, log, err)
			return
		}
		fmt.Println("Called vivid-api")

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
		fmt.Println("done!")
	}
}
