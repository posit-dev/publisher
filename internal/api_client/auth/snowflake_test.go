package auth

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/posit-dev/publisher/internal/api_client/auth/snowflake"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type SnowflakeAuthSuite struct {
	utiltest.Suite
}

func TestSnowflakeAuthSuite(t *testing.T) {
	suite.Run(t, new(SnowflakeAuthSuite))
}

func (s *SnowflakeAuthSuite) TestNewSnowflakeAuthenticator() {
	access := &snowflake.MockAccess{}
	connections := &snowflake.MockConnections{}
	connections.On("Get", ":name:").Return(&snowflake.Connection{}, errors.New("connection error")).Once()

	_, err := NewSnowflakeAuthenticator(connections, access, ":name:")
	s.ErrorContains(err, "connection error")

	connections.On("Get", ":name:").Return(&snowflake.Connection{
		PrivateKeyFile: "/no/exist/rsa_key.p8",
	}, nil).Once()

	_, err = NewSnowflakeAuthenticator(connections, access, ":name:")
	s.ErrorContains(err, "error loading private key file: ")

	wd, err := os.Getwd()
	s.NoError(err)

	connections.On("Get", ":name:").Return(&snowflake.Connection{
		PrivateKeyFile: fmt.Sprintf("%s/testdata/rsa_key.pub", wd),
	}, nil).Once()

	_, err = NewSnowflakeAuthenticator(connections, access, ":name:")
	s.ErrorContains(err, "decoding PEM data failed")

	connections.On("Get", ":name:").Return(&snowflake.Connection{
		PrivateKeyFile: fmt.Sprintf("%s/testdata/bad_key.p8", wd),
	}, nil).Once()

	_, err = NewSnowflakeAuthenticator(connections, access, ":name:")
	s.ErrorContains(err, "failed to decode private key: ")

	connections.On("Get", ":name:").Return(&snowflake.Connection{
		Account:        ":account:",
		User:           ":user:",
		PrivateKeyFile: fmt.Sprintf("%s/testdata/rsa_key.p8", wd),
	}, nil).Once()

	auth, err := NewSnowflakeAuthenticator(connections, access, ":name:")
	s.NoError(err)
	sfauth, ok := auth.(*snowflakeAuthenticator)
	s.True(ok)
	s.Equal(":account:", sfauth.account)
	s.Equal(":user:", sfauth.user)
	s.NotNil(sfauth.privateKey)
}

func (s *SnowflakeAuthSuite) TestAddAuthHeaders() {
	connections := &snowflake.MockConnections{}
	wd, err := os.Getwd()
	s.NoError(err)
	connections.On("Get", ":name:").Return(&snowflake.Connection{
		Account:        ":account:",
		User:           ":user:",
		PrivateKeyFile: fmt.Sprintf("%s/testdata/rsa_key.p8", wd),
	}, nil).Once()

	access := &snowflake.MockAccess{}
	access.On("GetSignedJWT", mock.Anything, ":account:", ":user:", mock.Anything).
		Return(":jwtoken:", nil).Once()
	access.On("GetAccessToken", ":account:", "example.snowflakecomputing.app", ":jwtoken:", "").
		Return(":atoken:", nil).Once()

	auth, err := NewSnowflakeAuthenticator(connections, access, ":name:")
	s.NoError(err)

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
	}, req.Header)
}
