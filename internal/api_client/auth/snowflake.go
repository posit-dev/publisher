package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
)

const headerName = "Authorization"

type snowflakeAuthenticator struct {
	account    string
	user       string
	privateKey *rsa.PrivateKey
}

func NewSnowflakeAuthenticator(connectionName string) (AuthMethod, error) {
	// initial testing of the server URL will not have a named connection
	// yet and does not need authentication to succeed (i.e. step 1 in the
	// new credential flow, before an API key or connection name is
	// entered)
	if connectionName == "" {
		return NewNullAuthenticator(), nil
	}
	conn, err := snowflake.GetConnection(connectionName)
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
	}, nil
}

func (a *snowflakeAuthenticator) AddAuthHeaders(req *http.Request) error {
	signedToken, err := getSignedJWT(
		a.privateKey,
		a.account,
		a.user,
		time.Now().Add(60*time.Second),
	)
	if err != nil {
		return err
	}
	host := req.URL.Hostname()
	token, err := getAccessToken(a.account, host, signedToken, "")
	if err != nil {
		return err
	}
	header := fmt.Sprintf(`Snowflake Token="%s"`, token)
	req.Header.Set(headerName, header)
	return nil
}

func getSignedJWT(privateKey *rsa.PrivateKey, account string, user string, expiration time.Time) (string, error) {
	// Serialize the public key to DER
	derPubKey, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return "", fmt.Errorf("failed to encode public key to DER: %w", err)
	}

	// Compute the SHA-256 hash of the DER-encoded public key
	sha256Hash := sha256.Sum256(derPubKey)

	// Encode the hash as a base64 string
	base64Hash := base64.StdEncoding.EncodeToString(sha256Hash[:])

	sub := strings.ToUpper(fmt.Sprintf("%s.%s", account, user))

	claims := jwt.MapClaims{
		"sub": sub,
		"iss": fmt.Sprintf("%s.SHA256:%s", sub, base64Hash),
		"iat": (time.Now()).Unix(),
		"exp": expiration.Unix(),
	}

	// Create the token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	// Sign the token using the RSA private key
	signedToken, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}

func getAccessToken(account string, ingressURL string, signedToken string, role string) (string, error) {
	scope := ingressURL
	if role != "" {
		scope = fmt.Sprintf("session:role:%s %s", role, ingressURL)
	}

	param := url.Values{
		"grant_type": []string{"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"scope":      []string{scope},
		"assertion":  []string{signedToken},
	}

	snowflakeTokenEndpoint := fmt.Sprintf("https://%s.snowflakecomputing.com/oauth/token", account)

	resp, err := http.Post(snowflakeTokenEndpoint, "application/x-www-form-urlencoded", bytes.NewBufferString(param.Encode()))
	if err != nil {
		return "", fmt.Errorf("requesting http token %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("failed to get access token")
	}

	accessToken, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response body: %w", err)
	}

	return string(accessToken), nil
}
