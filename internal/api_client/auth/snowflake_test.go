package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type SnowflakeAuthSuite struct {
	utiltest.Suite
	testdataDir string
}

func TestSnowflakeAuthSuite(t *testing.T) {
	suite.Run(t, new(SnowflakeAuthSuite))
}

func (s *SnowflakeAuthSuite) SetupTest() {
	var err error
	s.testdataDir, err = filepath.Abs("snowflake/testdata")
	s.Require().NoError(err)
}

func (s *SnowflakeAuthSuite) TestNewSnowflakeAuthenticator() {
	connections := &snowflake.MockConnections{}
	connections.On("Get", ":name:").Return(&snowflake.Connection{}, errors.New("connection error")).Once()

	_, err := NewSnowflakeAuthenticator(connections, ":name:", "test-api-key")
	s.ErrorContains(err, "connection error")

	// unsupported authenticator type
	connections.On("Get", ":name:").Return(&snowflake.Connection{
		Authenticator: "fake",
	}, nil).Once()

	_, err = NewSnowflakeAuthenticator(connections, ":name:", "test-api-key")
	s.EqualError(err, "unsupported authenticator type: fake")

	// errors from implementation are bubbled up
	connections.On("Get", ":name:").Return(&snowflake.Connection{
		PrivateKeyFile: "/no/exist/rsa_key.p8",
		Authenticator:  "snowflake_jwt",
	}, nil).Once()

	_, err = NewSnowflakeAuthenticator(connections, ":name:", "test-api-key")
	s.ErrorContains(err, "error loading private key file: ")

	// JWT token provider
	connections.On("Get", ":name:").Return(&snowflake.Connection{
		Account:        ":account:",
		User:           ":user:",
		PrivateKeyFile: fmt.Sprintf("%s/rsa_key.p8", s.testdataDir),
		Authenticator:  "snowflake_jwt",
	}, nil).Once()

	auth, err := NewSnowflakeAuthenticator(connections, ":name:", "test-api-key")
	s.NoError(err)
	sfauth, ok := auth.(*snowflakeAuthenticator)
	s.True(ok)
	s.NotNil(sfauth.tokenProvider)
	s.IsType(&snowflake.JWTTokenProvider{}, sfauth.tokenProvider)
	s.Equal("test-api-key", sfauth.apiKey)

	// oauth token provider
	connections.On("Get", ":name:").Return(&snowflake.Connection{
		Account:       ":account:",
		Token:         ":token:",
		Authenticator: "oauth",
	}, nil).Once()

	auth, err = NewSnowflakeAuthenticator(connections, ":name:", "test-api-key")
	s.NoError(err)
	sfauth, ok = auth.(*snowflakeAuthenticator)
	s.True(ok)
	s.NotNil(sfauth.tokenProvider)
	s.IsType(&snowflake.OAuthTokenProvider{}, sfauth.tokenProvider)
	s.Equal("test-api-key", sfauth.apiKey)
}

func (s *SnowflakeAuthSuite) TestAddAuthHeaders() {
	tokenProvider := &snowflake.MockTokenProvider{}
	tokenProvider.On("GetToken", "example.snowflakecomputing.app").Return(":atoken:", nil).Once()

	auth := &snowflakeAuthenticator{
		tokenProvider: tokenProvider,
		apiKey:        "test-api-key",
	}

	req, err := http.NewRequest("GET", "https://example.snowflakecomputing.app/connect/#/content", nil)
	s.NoError(err)
	req.Header.Add("X-Existing", "unchanged")

	err = auth.AddAuthHeaders(req)
	s.NoError(err)

	s.Equal(http.Header{
		"X-Existing": []string{"unchanged"},
		"Authorization": []string{
			"Snowflake Token=\":atoken:\"",
		},
		"X-Rsc-Authorization": []string{
			"Key test-api-key",
		},
	}, req.Header)

	// Test without API key
	tokenProvider.On("GetToken", "example.snowflakecomputing.app").Return(":atoken:", nil).Once()
	authNoKey := &snowflakeAuthenticator{
		tokenProvider: tokenProvider,
		apiKey:        "",
	}

	req2, err := http.NewRequest("GET", "https://example.snowflakecomputing.app/connect/#/content", nil)
	s.NoError(err)

	err = authNoKey.AddAuthHeaders(req2)
	s.NoError(err)

	s.Equal(http.Header{
		"Authorization": []string{
			"Snowflake Token=\":atoken:\"",
		},
	}, req2.Header)
}
