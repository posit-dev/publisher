package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
)

// getAccountResponse is the format of returned account data.
// It does not include credentials (ApiKey, Token, Secret, or PrivateKey).
type getAccountResponse struct {
	Type        string `json:"type"`        // Which type of API this server provides
	Source      string `json:"source"`      // Source of the saved server configuration
	AuthType    string `json:"authType"`    // Authentication method (API key, token, etc)
	Name        string `json:"name"`        // Nickname
	URL         string `json:"url"`         // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool   `json:"insecure"`    // Skip https server verification
	Certificate string `json:"caCert"`      // Root CA certificate, if server cert is signed by a private CA
	AccountName string `json:"accountName"` // For shinyapps.io and Posit Cloud servers
}

type getAccountsResponse []*getAccountResponse

// toGetAccountResponse converts an internal Account object
// to the DTO type we return from the API.
func toGetAccountResponse(acct *accounts.Account) *getAccountResponse {
	return &getAccountResponse{
		Type:        string(acct.ServerType),
		Source:      string(acct.Source),
		AuthType:    string(acct.AuthType),
		Name:        acct.Name,
		URL:         acct.URL,
		Insecure:    acct.Insecure,
		Certificate: acct.Certificate,
		AccountName: acct.AccountName,
	}
}

// GetAccountsHandlerFunc returns a handler for the account list.
func GetAccountsHandlerFunc(lister accounts.AccountList, log logging.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		accounts, err := lister.GetAccountsByServerType(accounts.ServerTypeConnect)
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		data := getAccountsResponse{}
		for _, acct := range accounts {
			data = append(data, toGetAccountResponse(&acct))
		}

		w.Header().Set("content-type", "application/json")
		json.NewEncoder(w).Encode(data)
	}
}
