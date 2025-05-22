package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
)

const headerName = "Authorization"

type snowflakeAuthenticator struct {
	account    string
	user       string
	privateKey *rsa.PrivateKey

	access snowflake.Access
}

// NewSnowflakeAuthenticator loads the Snowflake connection with the given name
// from the system Snowflake configuration and returns an authenticator that
// will add auth headers to requests.
//
// Only supports keypair authentication.
//
// Errs if the named connection cannot be found, or if the connection does not
// include a valid private key.
func NewSnowflakeAuthenticator(
	connections snowflake.Connections,
	access snowflake.Access,
	connectionName string,
) (AuthMethod, error) {
	conn, err := connections.Get(connectionName)
	if err != nil {
		return nil, err
	}

	pemData, err := os.ReadFile(conn.PrivateKeyFile)
	if err != nil {
		return nil, fmt.Errorf("error loading private key file: %w", err)
	}

	block, _ := pem.Decode(pemData)
	if block == nil || block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("decoding PEM data failed")
	}

	privKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	return &snowflakeAuthenticator{
		account:    conn.Account,
		user:       conn.User,
		privateKey: privKey.(*rsa.PrivateKey),

		access: access,
	}, nil
}

func (a *snowflakeAuthenticator) AddAuthHeaders(req *http.Request) error {
	signedToken, err := a.access.GetSignedJWT(
		a.privateKey,
		a.account,
		a.user,
		time.Now().Add(60*time.Second),
	)
	if err != nil {
		return err
	}
	host := req.URL.Hostname()
	token, err := a.access.GetAccessToken(a.account, host, signedToken, "")
	if err != nil {
		return err
	}
	header := fmt.Sprintf(`Snowflake Token="%s"`, token)
	req.Header.Set(headerName, header)
	return nil
}
