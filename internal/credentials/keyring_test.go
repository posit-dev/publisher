// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type KeyringCredentialsTestSuite struct {
	utiltest.Suite
	log *loggingtest.MockLogger
}

func TestKeyringCredentialsTestSuite(t *testing.T) {
	suite.Run(t, new(KeyringCredentialsTestSuite))
}

func (s *KeyringCredentialsTestSuite) SetupTest() {
	keyring.MockInit()
	s.log = loggingtest.NewMockLogger()
}

func (s *KeyringCredentialsTestSuite) TestNewKeyringCredentialsService() {
	ks := NewKeyringCredentialsService(s.log)
	s.Equal(ks, &keyringCredentialsService{s.log})
	s.Implements((*CredentialsService)(nil), ks)
}

func (s *KeyringCredentialsTestSuite) TestSet() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	cred, err := cs.Set(CreateCredentialDetails{
		ServerType:          server_type.ServerTypeConnect,
		Name:                "example",
		URL:                 "https://example.com",
		ApiKey:              "12345",
		SnowflakeConnection: ""})
	s.NoError(err)
	s.NotNil(cred.GUID)
	s.Equal(cred.Name, "example")
	s.Equal(cred.URL, "https://example.com")
	s.Equal(cred.ApiKey, "12345")
	s.Equal(cred.SnowflakeConnection, "")

	cred, err = cs.Set(CreateCredentialDetails{
		ServerType:          server_type.ServerTypeSnowflake,
		Name:                "sfexample",
		URL:                 "https://example.snowflakecomputing.app",
		ApiKey:              "",
		SnowflakeConnection: "snow"})
	s.NoError(err)
	s.NotNil(cred.GUID)
	s.Equal(cred.Name, "sfexample")
	s.Equal(cred.URL, "https://example.snowflakecomputing.app")
	s.Equal(cred.ApiKey, "")
	s.Equal(cred.SnowflakeConnection, "snow")

	cred, err = cs.Set(CreateCredentialDetails{
		ServerType:   server_type.ServerTypeConnectCloud,
		Name:         "cloudy",
		URL:          "https://api.connect.posit.cloud",
		AccountID:    "0de62804-2b0b-4e11-8a52-a402bda89ff4",
		AccountName:  "cloudy",
		RefreshToken: "some_refresh_token",
		AccessToken:  "some_access_token",
	})
	s.NoError(err)
	s.NotNil(cred.GUID)
	s.Equal(cred.Name, "cloudy")
	s.Equal(cred.URL, "https://api.connect.posit.cloud")
	s.Equal(cred.AccountID, "0de62804-2b0b-4e11-8a52-a402bda89ff4")
	s.Equal(cred.AccountName, "cloudy")
	s.Equal(cred.RefreshToken, "some_refresh_token")
	s.Equal(cred.AccessToken, types.CloudAuthToken("some_access_token"))
}

func (s *KeyringCredentialsTestSuite) TestSetURLCollisionError() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	_, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	_, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.Error(err)
	s.IsType(&CredentialIdentityCollision{}, err)
}

func (s *KeyringCredentialsTestSuite) TestGet() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	testGuid := "5ede880a-acd8-4206-b9fa-7d788c42fbe4"

	// First test without any credentials in environment
	s.log.On("Debug", "Credential does not exist", "credential", testGuid).Return()

	// error if missing
	_, err := cs.Get(testGuid)
	s.Error(err)
	s.log.AssertExpectations(s.T())

	// pass if exists
	cred, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	res, err := cs.Get(cred.GUID)
	s.NoError(err)
	s.Equal(res, cred)
}

func (s *KeyringCredentialsTestSuite) TestNormalizedSet() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	// pass if no change (already normalized)
	cred, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	res, err := cs.Get(cred.GUID)
	s.NoError(err)
	s.Equal(res.URL, cred.URL)

	// pass if URL ends up normalized
	cred, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example2", URL: "https://example.com///another/seg/", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	s.NotEqual(cred.URL, "https://example.com///another/seg/")

	res, err = cs.Get(cred.GUID)
	s.NoError(err)
	s.Equal(res.URL, "https://example.com/another/seg")
	s.Equal(cred.URL, res.URL)
}

func (s *KeyringCredentialsTestSuite) TestSetCollisions() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	// add a credential
	_, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)

	// name collision
	_, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://more_examples.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.Error(err)
	s.IsType(&NameCollisionError{}, err)

	// URL collision
	_, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "another_example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.Error(err)
	s.IsType(&CredentialIdentityCollision{}, err)
}

func (s *KeyringCredentialsTestSuite) TestList() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	creds, err := cs.List()
	s.NoError(err)
	s.Equal(creds, []Credential{})

	// Add a couple creds to be assert on the list again
	nc1, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://a.example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	nc2, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example2", URL: "https://b.example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)

	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 2)
	s.Contains(creds, *nc1)
	s.Contains(creds, *nc2)
}

func (s *KeyringCredentialsTestSuite) TestDelete() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	cred, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)

	// no error if exists
	err = cs.Delete(cred.GUID)
	s.NoError(err)

	// err if missing
	s.log.On("Debug", "Credential does not exist", "credential", cred.GUID).Return()
	err = cs.Delete(cred.GUID)
	s.Error(err)
	s.log.AssertExpectations(s.T())
}

func (s *KeyringCredentialsTestSuite) TestForceSet() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	// First test - add credential with regular Set
	cred, err := cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	s.Equal("example", cred.Name)

	// Using ForceSet to override name collision
	// This would normally fail with Set() due to name collision
	newcred, err := cs.ForceSet(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://modified.example.com", ApiKey: "modified-key", SnowflakeConnection: ""})
	s.NoError(err)
	s.Equal("example", newcred.Name)
	s.Equal("https://modified.example.com", newcred.URL)
	s.Equal("modified-key", newcred.ApiKey)

	// Verify that the credential was updated
	retCred, err := cs.Get(newcred.GUID)
	s.NoError(err)
	s.Equal("example", retCred.Name)
	s.Equal("https://modified.example.com", retCred.URL)
	s.Equal("modified-key", retCred.ApiKey)
}

func (s *KeyringCredentialsTestSuite) TestReset() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	creds, err := cs.List()
	s.NoError(err)
	s.Equal(creds, []Credential{})

	// Add a couple creds to be assert on the list again
	_, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example", URL: "https://a.example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)
	_, err = cs.Set(CreateCredentialDetails{ServerType: server_type.ServerTypeConnect, Name: "example2", URL: "https://b.example.com", ApiKey: "12345", SnowflakeConnection: ""})
	s.NoError(err)

	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 2)

	// Expected Log Warn
	s.log.On("Warn", "Corrupted credentials data found. The stored data was reset.", "credentials_service", "keyring").Return()

	_, err = cs.Reset()
	s.NoError(err)

	// Creds wiped out
	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 0)
}
