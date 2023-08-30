package api

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"net/http"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
)

// accountGetDTO is the format of returned account data.
// It does not include credentials (ApiKey, Token, Secret, or PrivateKey).
type accountGetDTO struct {
	Type        string `json:"type"`         // Which type of API this server provides
	Source      string `json:"source"`       // Source of the saved server configuration
	AuthType    string `json:"auth_type"`    // Authentication method (API key, token, etc)
	Name        string `json:"name"`         // Nickname
	URL         string `json:"url"`          // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool   `json:"insecure"`     // Skip https server verification
	Certificate string `json:"ca_cert"`      // Root CA certificate, if server cert is signed by a private CA
	AccountName string `json:"account_name"` // For shinyapps.io and Posit Cloud servers
}

type accountListDTO struct {
	Accounts []*accountGetDTO `json:"accounts"`
}

// toAccountDTO converts an internal Account object
// to the DTO type we return from the API.
func toAccountDTO(acct *accounts.Account) *accountGetDTO {
	return &accountGetDTO{
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
		accounts, err := lister.GetAllAccounts()
		if err != nil {
			InternalError(w, req, log, err)
			return
		}
		data := &accountListDTO{}
		for _, acct := range accounts {
			data.Accounts = append(data.Accounts, toAccountDTO(&acct))
		}
		json.NewEncoder(w).Encode(data)
	}
}
