package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
)

const headerName = "Authorization"

type snowflakeAuthenticator struct {
	tokenProvider snowflake.TokenProvider
	apiKey        string
}

var _ AuthMethod = &snowflakeAuthenticator{}

// NewSnowflakeAuthenticator loads the Snowflake connection with the given name
// from the system Snowflake configuration and returns an authenticator that
// will add auth headers to requests.
//
// For Snowflake SPCS with OIDC, this sets both:
// - Authorization header with the Snowflake token (for proxied auth)
// - X-RSC-Authorization header with the Connect API key (for Connect authentication)
//
// Only supports keypair authentication.
//
// Errs if the named connection cannot be found, or if the connection does not
// include a valid private key.
func NewSnowflakeAuthenticator(
	connections snowflake.Connections,
	connectionName string,
	apiKey string,
) (AuthMethod, error) {
	conn, err := connections.Get(connectionName)
	if err != nil {
		return nil, err
	}

	var tokenProvider snowflake.TokenProvider

	switch strings.ToLower(conn.Authenticator) {
	case "oauth":
		tokenProvider = snowflake.NewOAuthTokenProvider(
			conn.Account,
			conn.Token,
		)
	case "snowflake_jwt":
		tokenProvider, err = snowflake.NewJWTTokenProvider(
			conn.Account,
			conn.User,
			conn.PrivateKeyFile,
			"", // no role specified
		)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported authenticator type: %s", conn.Authenticator)
	}

	return &snowflakeAuthenticator{
		tokenProvider: tokenProvider,
		apiKey:        apiKey,
	}, nil
}

func (a *snowflakeAuthenticator) AddAuthHeaders(req *http.Request) error {
	host := req.URL.Hostname()
	token, err := a.tokenProvider.GetToken(host)
	if err != nil {
		return err
	}
	// Set Authorization header with Snowflake token for proxied authentication
	header := fmt.Sprintf(`Snowflake Token="%s"`, token)
	req.Header.Set(headerName, header)

	// Set X-RSC-Authorization header with Connect API key for OIDC authentication
	if a.apiKey != "" {
		apiKeyHeader := fmt.Sprintf("Key %s", a.apiKey)
		req.Header.Set("X-RSC-Authorization", apiKeyHeader)
	}
	return nil
}
