package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type JWTTokenProviderSuite struct {
	utiltest.Suite
	testdataDir string
}

func TestJWTTokenProviderSuite(t *testing.T) {
	suite.Run(t, new(JWTTokenProviderSuite))
}

func (s *JWTTokenProviderSuite) SetupTest() {
	var err error
	s.testdataDir, err = filepath.Abs("testdata")
	s.Require().NoError(err)
}

func (s *JWTTokenProviderSuite) TestNewJWTTokenProvider() {
	validKeyPath := filepath.Join(s.testdataDir, "rsa_key.p8")

	for _, tc := range []struct {
		role string
	}{
		{role: ""},
		{role: "test-role"},
	} {
		provider, err := NewJWTTokenProvider(
			"test-account",
			"test-user",
			validKeyPath,
			tc.role,
		)

		s.NoError(err)
		s.NotNil(provider)
		s.Equal("test-account", provider.account)
		s.Equal("test-user", provider.user)
		s.NotNil(provider.privateKey)
		s.Equal(tc.role, provider.role)
		s.Equal(
			"https://test-account.snowflakecomputing.com/oauth/token",
			provider.tokenEndpoint,
		)
	}
}

func (s *JWTTokenProviderSuite) TestNewJWTTokenProviderErrors() {
	for _, tc := range []struct {
		path string
		err  string
	}{
		{
			path: "/no/exist/rsa_key.p8",
			err:  "error loading private key file",
		},
		{
			// invalid PEM file (public key instead of private key)
			path: filepath.Join(s.testdataDir, "rsa_key.pub"),
			err:  "failed to decode PEM block containing private key",
		},
		{
			// malformed private key
			path: filepath.Join(s.testdataDir, "bad_key.p8"),
			err:  "failed to decode private key",
		},
	} {
		_, err := NewJWTTokenProvider(
			"test-account",
			"test-user",
			tc.path,
			"",
		)
		s.ErrorContains(err, tc.err)
	}

}

func (s *JWTTokenProviderSuite) TestGetToken() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.Equal("POST", r.Method)
		s.Equal("application/x-www-form-urlencoded", r.Header.Get("Content-Type"))

		defer r.Body.Close()
		body, err := io.ReadAll(r.Body)
		s.NoError(err)
		// grant_type and scope are predictable; JWT is not
		s.Regexp(
			regexp.MustCompile(`assertion=[a-zA-Z0-9._-]*&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&scope=https%3A%2F%2Fingress.example.com`),
			string(body),
		)

		fmt.Fprint(w, "test-token")
	}))
	defer ts.Close()

	validKeyPath := filepath.Join(s.testdataDir, "rsa_key.p8")
	provider, err := NewJWTTokenProvider(
		"test-account",
		"test-user",
		validKeyPath,
		"",
	)
	s.NoError(err)
	s.NotNil(provider)

	provider.tokenEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.NoError(err)
	s.Equal("test-token", token)
}

func (s *JWTTokenProviderSuite) TestGetTokenWithRole() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.Equal("POST", r.Method)
		s.Equal("application/x-www-form-urlencoded", r.Header.Get("Content-Type"))

		defer r.Body.Close()
		body, err := io.ReadAll(r.Body)
		s.NoError(err)
		// grant_type and scope are predictable; JWT is not
		s.Regexp(
			regexp.MustCompile(`assertion=[a-zA-Z0-9._-]*&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&scope=session%3Arole%3Atest-role\+https%3A%2F%2Fingress.example.com`),
			string(body),
		)

		fmt.Fprint(w, "test-token")
	}))
	defer ts.Close()

	validKeyPath := filepath.Join(s.testdataDir, "rsa_key.p8")
	provider, err := NewJWTTokenProvider(
		"test-account",
		"test-user",
		validKeyPath,
		"test-role",
	)
	s.NoError(err)
	s.NotNil(provider)

	provider.tokenEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.NoError(err)
	s.Equal("test-token", token)
}

func (s *JWTTokenProviderSuite) TestGetTokenStatusErr() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts.Close()

	validKeyPath := filepath.Join(s.testdataDir, "rsa_key.p8")
	provider, err := NewJWTTokenProvider(
		"test-account",
		"test-user",
		validKeyPath,
		"",
	)
	s.NoError(err)
	s.NotNil(provider)

	provider.tokenEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.ErrorContains(err, "failed to get access token: error status from token exchange: 500")
	s.Equal("", token)
}

type OAuthTokenProviderSuite struct {
	utiltest.Suite
	testdataDir string
}

func TestOAuthTokenProviderSuite(t *testing.T) {
	suite.Run(t, new(OAuthTokenProviderSuite))
}

func (s *OAuthTokenProviderSuite) SetupTest() {
	var err error
	s.testdataDir, err = filepath.Abs("testdata")
	s.Require().NoError(err)
}

func (s *OAuthTokenProviderSuite) TestNewOauthTokenProvider() {
	provider := NewOAuthTokenProvider(
		"test-account",
		"test-token",
	)
	s.NotNil(provider)
	s.Equal("test-account", provider.account)
	s.Equal("test-token", provider.token)
	s.Equal(
		"https://test-account.snowflakecomputing.com/session/v1/login-request",
		provider.loginEndpoint,
	)
}

func (s *OAuthTokenProviderSuite) TestGetToken() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.Equal("POST", r.Method)
		s.Equal("application/json", r.Header.Get("Content-Type"))
		s.Equal("application/snowflake", r.Header.Get("Accept"))

		defer r.Body.Close()
		body, err := io.ReadAll(r.Body)
		s.NoError(err)
		var data map[string]any
		err = json.Unmarshal(body, &data)
		s.NoError(err)
		s.Equal(map[string]any{
			"data": map[string]any{
				"ACCOUNT_NAME":  "test-account",
				"TOKEN":         "test-token",
				"AUTHENTICATOR": "OAUTH",
			},
		}, data)

		fmt.Fprint(w, `{"data":{"token":"result-token"}}`)
	}))
	defer ts.Close()

	provider := NewOAuthTokenProvider(
		"test-account",
		"test-token",
	)
	s.NotNil(provider)

	provider.loginEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.NoError(err)
	s.Equal("result-token", token)
}

func (s *OAuthTokenProviderSuite) TestGetTokenStatusErr() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer ts.Close()

	provider := NewOAuthTokenProvider(
		"test-account",
		"test-token",
	)
	s.NotNil(provider)

	provider.loginEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.ErrorContains(err, "error status from login-request:  500")
	s.Equal("", token)
}

func (s *OAuthTokenProviderSuite) TestGetTokenParseErr() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `notjson`)
	}))
	defer ts.Close()

	provider := NewOAuthTokenProvider(
		"test-account",
		"test-token",
	)
	s.NotNil(provider)

	provider.loginEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.ErrorContains(err, "error parsing login response body: ")
	s.Equal("", token)
}

func (s *OAuthTokenProviderSuite) TestGetTokenTokenErr() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"data":{"token":""}}`)
	}))
	defer ts.Close()

	provider := NewOAuthTokenProvider(
		"test-account",
		"test-token",
	)
	s.NotNil(provider)

	provider.loginEndpoint = ts.URL

	token, err := provider.GetToken("https://ingress.example.com")
	s.ErrorContains(err, "missing token in login response")
	s.Equal("", token)
}
