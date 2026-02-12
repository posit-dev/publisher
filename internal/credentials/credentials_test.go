// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type CredentialsServiceTestSuite struct {
	utiltest.Suite
	log *loggingtest.MockLogger
}

func TestCredentialsServiceTestSuite(t *testing.T) {
	suite.Run(t, new(CredentialsServiceTestSuite))
}

func (s *CredentialsServiceTestSuite) SetupTest() {
	s.log = loggingtest.NewMockLogger()
}

func (s *CredentialsServiceTestSuite) TestCredential_ConflictCheck_Connect() {
	cred := Credential{
		GUID:       "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:       "friedtofu",
		URL:        "https://a1.connect-server:3939/connect",
		ServerType: server_type.ServerTypeConnect,
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
		// Note: AccountID is empty for Connect credentials
	}

	// Different URL, should not conflict
	err := cred.ConflictCheck(Credential{
		Name:       "no friedtofu",
		URL:        "https://nota1.connect-server:3939/connect",
		ServerType: server_type.ServerTypeConnect,
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.NoError(err)

	// Same name, should conflict
	err = cred.ConflictCheck(Credential{
		Name:       "friedtofu",
		URL:        "https://nota1.connect-server:3939/connect",
		ServerType: server_type.ServerTypeConnect,
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.EqualError(err, "Name value conflicts with existing credential (friedtofu) URL: https://a1.connect-server:3939/connect")

	// Same URL with empty AccountID, should conflict
	err = cred.ConflictCheck(Credential{
		Name:       "no friedtofu",
		URL:        "https://a1.connect-server:3939/connect",
		ServerType: server_type.ServerTypeConnect,
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.EqualError(err, "URL value conflicts with existing credential (friedtofu) URL: https://a1.connect-server:3939/connect")
}

func (s *CredentialsServiceTestSuite) TestCredential_ConflictCheck_ConnectCloud() {
	cloudCred := Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "friedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "123",
		AccountName:      "fried tofu",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production",
	}
	err := cloudCred.ConflictCheck(Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "nofriedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "123",
		AccountName:      "friedtofu",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production",
	})
	s.EqualError(err, "URL value conflicts with existing credential (friedtofu) URL: https://api.connect.posit.cloud, account name: fried tofu")

	err = cloudCred.ConflictCheck(Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "nofriedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "456",
		AccountName:      "friedpotato",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production",
	})
	s.NoError(err)

	// Test that same AccountID with different CloudEnvironment doesn't conflict
	err = cloudCred.ConflictCheck(Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "nofriedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "123", // Same AccountID
		AccountName:      "fried tofu",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "staging", // Different environment
	})
	s.NoError(err)

	// Test that different AccountID with same CloudEnvironment doesn't conflict
	err = cloudCred.ConflictCheck(Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "nofriedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "789", // Different AccountID
		AccountName:      "friedpotato",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production", // Same environment
	})
	s.NoError(err)

	// Test that same AccountID AND same CloudEnvironment causes a conflict
	err = cloudCred.ConflictCheck(Credential{
		GUID:             "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:             "nofriedtofu",
		URL:              "https://api.connect.posit.cloud",
		ServerType:       server_type.ServerTypeConnectCloud,
		AccountID:        "123", // Same AccountID
		AccountName:      "fried tofu",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production", // Same environment
	})
	s.EqualError(err, "URL value conflicts with existing credential (friedtofu) URL: https://api.connect.posit.cloud, account name: fried tofu")
}

func (s *CredentialsServiceTestSuite) TestCredentialRecord() {
	record := CredentialRecord{
		GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Version: 0,
		Data: []byte(`
		{"guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","name":"friedtofu",
		"url": "https://a1.connect-server:3939/connect","apiKey":"abcdeC2aqbh7dg8TO43XPu7r56YDh000"}`),
	}

	credResult, err := record.ToCredential()
	s.NoError(err)
	s.Equal(credResult, &Credential{
		ServerType: server_type.ServerTypeConnect,
		GUID:       "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:       "friedtofu",
		URL:        "https://a1.connect-server:3939/connect",
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
}

func (s *CredentialsServiceTestSuite) TestCredentialRecordWithToken() {
	// Test V3 record with token authentication
	record := CredentialRecord{
		GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Version: 3,
		Data: []byte(`
		{"guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","name":"friedtofu",
		"url": "https://a1.connect-server:3939/connect","serverType":"connect",
		"token":"T12345abcdef","privateKey":"base64-encoded-private-key"}`),
	}

	credResult, err := record.ToCredential()
	s.NoError(err)
	s.Equal(credResult, &Credential{
		ServerType: server_type.ServerTypeConnect,
		GUID:       "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:       "friedtofu",
		URL:        "https://a1.connect-server:3939/connect",
		ApiKey:     "",
		Token:      "T12345abcdef",
		PrivateKey: "base64-encoded-private-key",
	})

	// Test v2 to v3 upgrade
	recordV2 := CredentialRecord{
		GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Version: 2,
		Data: []byte(`
		{"guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","name":"friedtofu",
		"url": "https://a1.connect-server:3939/connect","serverType":"connect","apiKey":"abcdeC2aqbh7dg8TO43XPu7r56YDh000"}`),
	}

	credResultV2, err := recordV2.ToCredential()
	s.NoError(err)
	s.Equal(credResultV2, &Credential{
		ServerType: server_type.ServerTypeConnect,
		GUID:       "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:       "friedtofu",
		URL:        "https://a1.connect-server:3939/connect",
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
		Token:      "",
		PrivateKey: "",
	})
}

func (s *CredentialsServiceTestSuite) TestCredentialRecord_CorruptedErr() {
	record := CredentialRecord{
		GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Version: 0,
		Data: []byte(`
		$. 8989 guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","name":"friedtofu",
		"url": "https://a1.connect-server:3939/connect","apiKey":"abcdeC2aqbh7dg8TO43XPu7r56YDh000"}`),
	}

	_, err := record.ToCredential()
	s.EqualError(err, "credential '18cd5640-bee5-4b2a-992a-a2725ab6103d' is corrupted")
}

func (s *CredentialsServiceTestSuite) TestCredentialRecord_VersionErr() {
	record := CredentialRecord{
		GUID:    "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Version: 45,
		Data: []byte(`
		{"guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","name":"friedtofu",
		"url": "https://a1.connect-server:3939/connect","apiKey":"abcdeC2aqbh7dg8TO43XPu7r56YDh000"}`),
	}

	_, err := record.ToCredential()
	s.EqualError(err, "credential version not supported: 45")
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_KeyringOK() {
	keyring.MockInit()

	// Don't set credentials.UseKeychain to any value, let it default

	s.log.On("Debug", "Using keychain for credential storage.").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), credservice)
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_KeyringErrFallbackFile() {
	// Use an in memory filesystem for this test
	// avoiding to manipulate users ~/.connect-credentials
	fsys = afero.NewMemMapFs()
	defer func() { fsys = afero.NewOsFs() }()

	keyringErr := errors.New("this is a teapot, unsupported system")
	keyring.MockInitWithError(keyringErr)

	s.log.On("Debug", "System keyring service is not available", "error", "failed to get known credential GUIDs: this is a teapot, unsupported system").Return()
	s.log.On("Debug", "Fallback to file managed credentials service due to unavailable system keyring.").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), credservice)
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_WithUseKeyringTrue() {
	keyring.MockInit()

	// set credentials.UseKeychain to true
	UseKeychain = true

	s.log.On("Debug", "Using keychain for credential storage.").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), credservice)
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_WithUseKeyringFalse() {
	// Use an in memory filesystem for this test
	// avoiding to manipulate users ~/.connect-credentials
	fsys = afero.NewMemMapFs()
	defer func() { fsys = afero.NewOsFs() }()

	keyring.MockInit()

	s.log.On("Debug", "Configuration has disabled keychain credentials. Using file managed credentials instead.").Return()

	// set credentials.UseKeychain to true
	UseKeychain = false

	credservice, err := NewCredentialsService(s.log)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), credservice)
}

type CreateCredentialDetailsTestSuite struct {
	utiltest.Suite
	//log *loggingtest.MockLogger
}

func TestCreateCredentialDetailsTestSuite(t *testing.T) {
	suite.Run(t, new(CreateCredentialDetailsTestSuite))
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential() {
	details := CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "newcred",
		URL:        "https://b2.connect-server:3939/connect",
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh002"}
	cred, err := details.ToCredential()
	s.NoError(err)
	s.NotEmpty(cred.GUID)
	s.Equal(cred.Name, details.Name)
	s.Equal(cred.URL, details.URL)
	s.Equal(cred.ApiKey, details.ApiKey)
	s.Equal(cred.ServerType, server_type.ServerTypeConnect)
	s.Equal(cred.SnowflakeConnection, "")
	s.Equal(cred.AccountID, "")
	s.Equal(cred.AccountName, "")
	s.Equal(cred.RefreshToken, "")
	s.Equal(cred.AccessToken, types.CloudAuthToken(""))
	s.Equal(cred.CloudEnvironment, types.CloudEnvironment(""))
	s.Equal(cred.Token, "")
	s.Equal(cred.PrivateKey, "")
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential_ConnectCloud() {
	details := CreateCredentialDetails{
		ServerType:       server_type.ServerTypeConnectCloud,
		Name:             "cloudcred",
		URL:              "https://api.connect.posit.cloud",
		AccountID:        "123",
		AccountName:      "myaccount",
		RefreshToken:     "refresh-token",
		AccessToken:      "access-token",
		CloudEnvironment: "production",
	}
	cred, err := details.ToCredential()
	s.NoError(err)
	s.NotEmpty(cred.GUID)
	s.Equal(cred.Name, details.Name)
	s.Equal(cred.URL, details.URL)
	s.Equal(cred.ServerType, server_type.ServerTypeConnectCloud)
	s.Equal(cred.AccountID, details.AccountID)
	s.Equal(cred.AccountName, details.AccountName)
	s.Equal(cred.RefreshToken, details.RefreshToken)
	s.Equal(cred.AccessToken, details.AccessToken)
	s.Equal(cred.CloudEnvironment, details.CloudEnvironment)
	s.Equal(cred.ApiKey, "")
	s.Equal(cred.SnowflakeConnection, "")
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential_TokenAuth() {
	details := CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "token-auth-cred",
		URL:        "https://b2.connect-server:3939/connect",
		Token:      "T12345abcdef",
		PrivateKey: "base64-encoded-private-key"}
	cred, err := details.ToCredential()
	s.NoError(err)
	s.NotEmpty(cred.GUID)
	s.Equal(cred.Name, details.Name)
	s.Equal(cred.URL, details.URL)
	s.Equal(cred.Token, details.Token)
	s.Equal(cred.PrivateKey, details.PrivateKey)
	s.Equal(cred.ServerType, server_type.ServerTypeConnect)
	s.Equal(cred.ApiKey, "")
	s.Equal(cred.SnowflakeConnection, "")
	s.Equal(cred.AccountID, "")
	s.Equal(cred.AccountName, "")
	s.Equal(cred.RefreshToken, "")
	s.Equal(cred.AccessToken, types.CloudAuthToken(""))
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential_InvalidTokenAuth() {
	// Missing private key
	details := CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "token-auth-cred",
		URL:        "https://b2.connect-server:3939/connect",
		Token:      "T12345abcdef"}
	_, err := details.ToCredential()
	s.Error(err)

	// Missing token
	details = CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "token-auth-cred",
		URL:        "https://b2.connect-server:3939/connect",
		PrivateKey: "base64-encoded-private-key"}
	_, err = details.ToCredential()
	s.Error(err)

	// Both API key and token auth (not allowed)
	details = CreateCredentialDetails{
		ServerType: server_type.ServerTypeConnect,
		Name:       "token-auth-cred",
		URL:        "https://b2.connect-server:3939/connect",
		ApiKey:     "abcdeC2aqbh7dg8TO43XPu7r56YDh002",
		Token:      "T12345abcdef",
		PrivateKey: "base64-encoded-private-key"}
	_, err = details.ToCredential()
	s.Error(err)
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential_BlankDataErr() {
	testCases := map[string]CreateCredentialDetails{
		"empty credential":             {URL: "https://b2.connect-server:3939/connect", ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty URL":                    {Name: "newcred", ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty creds":                  {Name: "newcred", URL: "https://b2.connect-server:3939/connect"},
		"partial Connect Cloud cred 1": {Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccountName: "friedtofu"},
		"partial Connect Cloud cred 2": {Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccountID: "1234"},
		"partial Connect Cloud cred 3": {Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccessToken: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"partial Connect Cloud cred 4": {Name: "newcred", URL: "https://b2.connect-server:3939/connect", RefreshToken: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"partial Token cred 1":         {Name: "newcred", URL: "https://b2.connect-server:3939/connect", Token: "T12345abcdef"},
		"partial Token cred 2":         {Name: "newcred", URL: "https://b2.connect-server:3939/connect", PrivateKey: "base64-encoded-private-key"},
		"both API Key and Token":       {Name: "newcred", URL: "https://b2.connect-server:3939/connect", ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002", Token: "T12345abcdef", PrivateKey: "base64-encoded-private-key"},
	}

	for _, createCredDetails := range testCases {
		_, err := createCredDetails.ToCredential()
		s.Error(err)
		s.Equal("New credentials require non-empty Name, URL, Server Type, and either API Key, Snowflake, or Connect Cloud connection fields", err.Error())
	}
}
