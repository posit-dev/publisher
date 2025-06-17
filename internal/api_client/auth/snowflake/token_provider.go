package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenProvider uses a snowflake connection to get an ingress access token.
type TokenProvider interface {
	// GetToken returns an access token for the given host
	GetToken(host string) (string, error)
}

// JWTTokenProvider uses key-pair authentication.
type JWTTokenProvider struct {
	account    string
	user       string
	privateKey *rsa.PrivateKey
	role       string // Optional role to use for the token

	tokenEndpoint string // OAuth token exchange URL, to override in tests
}

var _ TokenProvider = &JWTTokenProvider{}

// NewJWTTokenProvider creates a new TokenProvider that uses JWT authentication,
// loading the private key from the specified file path
func NewJWTTokenProvider(
	account string,
	user string,
	privateKeyFile string,
	role string,
) (*JWTTokenProvider, error) {
	pemData, err := os.ReadFile(privateKeyFile)
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

	tokenEndpoint := fmt.Sprintf("https://%s.snowflakecomputing.com/oauth/token", account)

	return &JWTTokenProvider{
		account:       account,
		user:          user,
		privateKey:    privKey.(*rsa.PrivateKey),
		role:          role,
		tokenEndpoint: tokenEndpoint,
	}, nil
}

// GetToken generates a JWT, then exchanges it for an access token
func (p *JWTTokenProvider) GetToken(host string) (string, error) {
	// Generate the JWT with a 60 second expiration
	signedToken, err := p.getSignedJWT(time.Now().Add(60 * time.Second))
	if err != nil {
		return "", fmt.Errorf("failed to generate JWT: %w", err)
	}

	// Exchange the JWT for an access token
	token, err := p.getAccessToken(host, signedToken)
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}

	return token, nil
}

func (p *JWTTokenProvider) getSignedJWT(expiration time.Time) (string, error) {
	// Serialize the public key to DER
	derPubKey, err := x509.MarshalPKIXPublicKey(&p.privateKey.PublicKey)
	if err != nil {
		return "", fmt.Errorf("failed to encode public key to DER: %w", err)
	}

	// Compute the SHA-256 hash of the DER-encoded public key
	sha256Hash := sha256.Sum256(derPubKey)

	// Encode the hash as a base64 string
	base64Hash := base64.StdEncoding.EncodeToString(sha256Hash[:])

	sub := strings.ToUpper(fmt.Sprintf("%s.%s", p.account, p.user))

	claims := jwt.MapClaims{
		"sub": sub,
		"iss": fmt.Sprintf("%s.SHA256:%s", sub, base64Hash),
		"iat": (time.Now()).Unix(),
		"exp": expiration.Unix(),
	}

	// Create the token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	// Sign the token using the RSA private key
	signedToken, err := token.SignedString(p.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}

func (p *JWTTokenProvider) getAccessToken(ingressURL string, signedToken string) (string, error) {
	scope := ingressURL
	if p.role != "" {
		scope = fmt.Sprintf("session:role:%s %s", p.role, ingressURL)
	}

	param := url.Values{
		"grant_type": []string{"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"scope":      []string{scope},
		"assertion":  []string{signedToken},
	}

	resp, err := http.Post(p.tokenEndpoint, "application/x-www-form-urlencoded", bytes.NewBufferString(param.Encode()))
	if err != nil {
		return "", fmt.Errorf("error making token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("error status from token exchange: %d", resp.StatusCode)
	}

	accessToken, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading response body: %w", err)
	}

	return string(accessToken), nil
}

// OAuthTokenProvider uses Snowflake's login-request flow with OAUTH
// authenticator.
type OAuthTokenProvider struct {
	account string
	token   string

	loginEndpoint string // snowflake login url, to override in tests
}

var _ TokenProvider = &OAuthTokenProvider{}

// NewOAuthTokenProvider creates a new TokenProvider that uses Snowflake's
// login-request flow.
func NewOAuthTokenProvider(account string, token string) *OAuthTokenProvider {
	return &OAuthTokenProvider{
		account:       account,
		token:         token,
		loginEndpoint: fmt.Sprintf("https://%s.snowflakecomputing.com/session/v1/login-request", account),
	}
}

// GetToken logs in to snowflake using the OAuth token and retrieves a session
// token.
func (p *OAuthTokenProvider) GetToken(host string) (string, error) {
	reqData := map[string]any{
		"data": map[string]string{
			"ACCOUNT_NAME": p.account,
			// workbench is not providing a user name,
			// but it seems to not be actually required anyway
			// "LOGIN_NAME": user,
			"TOKEN":         p.token,
			"AUTHENTICATOR": "OAUTH",
		},
	}
	reqJson, err := json.Marshal(reqData)
	if err != nil {
		return "", fmt.Errorf("error building login-request data: %w", err)
	}

	req, err := http.NewRequest("POST", p.loginEndpoint, bytes.NewBuffer(reqJson))
	if err != nil {
		return "", err
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Accept", "application/snowflake")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("error making login-request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("error status from login-request:  %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading login response body: %w", err)
	}

	type loginData struct {
		Token string `json:"token"`
	}
	type loginResponse struct {
		Data loginData `json:"data"`
	}
	var data = loginResponse{}
	err = json.Unmarshal(body, &data)
	if err != nil {
		return "", fmt.Errorf("error parsing login response body: %w", err)
	}

	if data.Data.Token == "" {
		return "", fmt.Errorf("missing token in login response")
	}

	return data.Data.Token, nil
}
