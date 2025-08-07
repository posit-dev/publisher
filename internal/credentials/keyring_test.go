// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util/utiltest"

	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
)

type KeyringCredentialsTestSuite struct {
	utiltest.Suite
	log *loggingtest.MockLogger
}

func TestKeyringCredentialsTestSuite(t *testing.T) {
	suite.Run(t, new(KeyringCredentialsTestSuite))
}

// TestLargeCredentials tests that large credentials can be stored and retrieved
// This is to verify the fix for the issue with the 3,000 byte limit on macOS keychain
func (s *KeyringCredentialsTestSuite) TestLargeCredentials() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	// Create a large API key (over 3000 bytes)
	largeApiKey := make([]byte, 3500)
	for i := range largeApiKey {
		largeApiKey[i] = byte(65 + (i % 26)) // ASCII values for uppercase letters
	}

	// Create a credential with the large API key
	cred, err := cs.Set(CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "large-cred",
		URL:        "https://example.com/large",
		ApiKey:     string(largeApiKey),
	})
	s.NoError(err, "Setting large credential should succeed")
	s.NotNil(cred, "Credential should be created")

	// Try to retrieve it
	retrieved, err := cs.Get(cred.GUID)
	s.NoError(err, "Getting large credential should succeed")
	s.Equal(string(largeApiKey), retrieved.ApiKey, "Retrieved credential should have same large API key")

	// Verify it shows up in the list
	creds, err := cs.List()
	s.NoError(err)
	s.Contains(creds, *cred, "Listed credentials should contain the large credential")
}

// TestMigrationFromLegacy tests that credentials are properly migrated from the legacy format
func (s *KeyringCredentialsTestSuite) TestMigrationFromLegacy() {
	// Create a table with some credentials in the legacy format
	table := make(map[string]CredentialRecord)

	// Add a couple of test credentials
	cred1 := Credential{
		GUID:       "test-guid-1",
		Name:       "legacy-cred-1",
		ServerType: server_type.ServerTypeConnect,
		URL:        "https://legacy1.example.com",
		ApiKey:     "legacy-apikey-1",
	}
	raw1, _ := json.Marshal(cred1)
	table[cred1.GUID] = CredentialRecord{
		GUID:    cred1.GUID,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw1),
	}

	cred2 := Credential{
		GUID:       "test-guid-2",
		Name:       "legacy-cred-2",
		ServerType: server_type.ServerTypeConnect,
		URL:        "https://legacy2.example.com",
		ApiKey:     "legacy-apikey-2",
	}
	raw2, _ := json.Marshal(cred2)
	table[cred2.GUID] = CredentialRecord{
		GUID:    cred2.GUID,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw2),
	}

	// Save the table using the legacy format
	data, _ := json.Marshal(table)
	err := keyring.Set(ServiceName, LegacyKey, string(data))
	s.NoError(err, "Should be able to set legacy credentials")

	// Initialize the keyring service, which should trigger migration
	cs := NewKeyringCredentialsService(s.log)

	creds, err := cs.List()
	s.NoError(err, "Should be able to list credentials")
	s.Len(creds, 2, "Should have two credentials after migration")

	// Check that both credentials were migrated correctly
	foundCred1 := false
	foundCred2 := false
	for _, cred := range creds {
		if cred.GUID == cred1.GUID {
			s.Equal(cred1.Name, cred.Name)
			s.Equal(cred1.URL, cred.URL)
			s.Equal(cred1.ApiKey, cred.ApiKey)
			foundCred1 = true
		}
		if cred.GUID == cred2.GUID {
			s.Equal(cred2.Name, cred.Name)
			s.Equal(cred2.URL, cred.URL)
			s.Equal(cred2.ApiKey, cred.ApiKey)
			foundCred2 = true
		}
	}

	s.True(foundCred1, "Should find credential 1 after migration")
	s.True(foundCred2, "Should find credential 2 after migration")

	// Check that the legacy key is deleted (eventually)
	require.Eventually(s.T(), func() bool {
		// Check that the legacy key was deleted
		_, err := keyring.Get(ServiceName, LegacyKey)
		return err == keyring.ErrNotFound
	}, 2*time.Second, 50*time.Millisecond, "Legacy key should be deleted after migration")

	s.log.AssertExpectations(s.T())
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

	// Get the list of known GUIDs to verify the cache is updated
	guids, err := cs.getKnownCredentialGuids()
	s.NoError(err)
	s.Contains(guids, cred.GUID, "GUID should be in the cache before deletion")

	// Log expectations for deletion
	s.log.On("Debug", "Failed to delete individual credential from keyring", "credential", cred.GUID, "error", "secret not found").Maybe().Return()
	s.log.On("Debug", "Failed to remove GUID from cache", "error", "failed to save GUIDs cache: failed to serialize GUIDs cache: json: unsupported type: map[string]struct {}").Maybe().Return()

	// no error if exists
	err = cs.Delete(cred.GUID)
	s.NoError(err)

	// Check if the GUID was removed from the cache
	guids, err = cs.getKnownCredentialGuids()
	s.NoError(err)
	for _, guid := range guids {
		if guid == cred.GUID {
			s.Fail("GUID should not be in the cache after deletion")
		}
	}

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
	s.Equal(cred.GUID, newcred.GUID, "cred should be replaced rather than created")

	// Verify that the credential was updated
	retCred, err := cs.Get(newcred.GUID)
	s.NoError(err)
	s.Equal("example", retCred.Name)
	s.Equal("https://modified.example.com", retCred.URL)
	s.Equal("modified-key", retCred.ApiKey)

	allCreds, err := cs.List()
	s.NoError(err)
	s.Len(allCreds, 1, "a duplicate credential should not have been created")
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

	// Expected Debug logs from the reset method
	s.log.On("Debug", "Failed to delete legacy credentials entry", "error", "secret not found").Maybe().Return()
	s.log.On("Debug", "Failed to delete cached credential GUIDs", "error", "secret not found").Maybe().Return()

	_, err = cs.Reset()
	s.NoError(err)

	// Creds wiped out
	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 0)
}
