package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/rstudio/publishing-client/internal/accounts"
)

type AuthMethod interface {
	AddAuthHeaders(req *http.Request) error
}

func NewClientAuth(acct *accounts.Account) AuthMethod {
	switch acct.AuthType {
	case accounts.AuthTypeAPIKey:
		return NewApiKeyAuthenticator(acct.ApiKey, "")
	case accounts.AuthTypeTokenKey, accounts.AuthTypeTokenSecret:
		return NewTokenAuthenticator(acct.Token, acct.Secret, acct.PrivateKey)
	case accounts.AuthTypeNone:
		// This is bogus since we know we can't publish
		// without authentication. Our workflow needs to do one
		// of the following:
		// * Obtain credentials from the saved account list,
		//   command line, or environment variables.
		// * Prompt the user interactively (via the CLI or UI)
		//   or walk them through the token flow.
		// * Err if neither of the above can be done.
		return NewNullAuthenticator()
	}
	return nil
}
