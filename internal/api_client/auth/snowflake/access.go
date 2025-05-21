package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Access generates Snowflake-specific JWTs and OAuth tokens.
// See https://github.com/rstudio/snowflake-lib/
type Access interface {
	GetSignedJWT(privateKey *rsa.PrivateKey, account string, user string, expiration time.Time) (string, error)
	GetAccessToken(account string, ingressURL string, signedToken string, role string) (string, error)
}

type defaultAccess struct{}

var _ Access = &defaultAccess{}

func NewAccess() Access {
	return &defaultAccess{}
}

func (*defaultAccess) GetSignedJWT(privateKey *rsa.PrivateKey, account string, user string, expiration time.Time) (string, error) {
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

func (*defaultAccess) GetAccessToken(account string, ingressURL string, signedToken string, role string) (string, error) {
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
