package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
)

type AuthMethod interface {
	AddAuthHeaders(req *http.Request) error
}

type AuthFactory struct {
	connections snowflake.Connections
}

func NewAuthFactory() AuthFactory {
	return AuthFactory{
		connections: snowflake.NewConnections(),
	}
}

func (af AuthFactory) NewClientAuth(acct *accounts.Account) (AuthMethod, error) {
	switch acct.AuthType() {
	case accounts.AuthTypeAPIKey:
		return NewApiKeyAuthenticator(acct.ApiKey, ""), nil
	case accounts.AuthTypeSnowflake:
		auth, err := NewSnowflakeAuthenticator(
			af.connections,
			acct.SnowflakeConnection,
		)
		if err != nil {
			return nil, err
		}
		return auth, nil
	case accounts.AuthTypeToken:
		auth, err := NewTokenAuthenticator(acct.Token, acct.PrivateKey)
		if err != nil {
			return nil, err
		}
		return auth, nil
	case accounts.AuthTypeNone:
		// We can't publish without authentication. However, when a
		// user is adding a new credential, the first thing we do is
		// test the server URL without any credentials. This test will
		// use the NullAuthenticator. Subsequent steps add either an
		// API Key or a Snowflake connection.
		return NewNullAuthenticator(), nil
	}
	return nil, nil
}
