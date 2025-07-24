// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/server_type"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
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

func (s *CredentialsServiceTestSuite) TestCredential() {
	cred := Credential{
		GUID:   "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:   "friedtofu",
		URL:    "https://a1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	}

	err := cred.ConflictCheck(Credential{
		Name:   "no friedtofu",
		URL:    "https://nota1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.NoError(err)

	err = cred.ConflictCheck(Credential{
		Name:   "friedtofu",
		URL:    "https://nota1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.EqualError(err, "Name value conflicts with existing credential (friedtofu) URL: https://a1.connect-server:3939/connect")

	err = cred.ConflictCheck(Credential{
		Name:   "no friedtofu",
		URL:    "https://a1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
	})
	s.EqualError(err, "URL value conflicts with existing credential (friedtofu) URL: https://a1.connect-server:3939/connect")

	cloudCred := Credential{
		GUID:         "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:         "friedtofu",
		URL:          "https://api.connect.posit.cloud",
		AccountID:    "123",
		AccountName:  "fried tofu",
		RefreshToken: "refresh-token",
		AccessToken:  "access-token",
	}
	err = cloudCred.ConflictCheck(Credential{
		GUID:         "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:         "nofriedtofu",
		URL:          "https://api.connect.posit.cloud",
		AccountID:    "123",
		AccountName:  "friedtofu",
		RefreshToken: "refresh-token",
		AccessToken:  "access-token",
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

	s.log.On("Debug", "System keyring service is not available", "error", "failed to load credentials: this is a teapot, unsupported system").Return()
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
	s.Equal(cred.AccessToken, "")
}

func (s *CreateCredentialDetailsTestSuite) TestToCredential_BlankDataErr() {
	testCases := map[string]CreateCredentialDetails{
		"empty credential":             CreateCredentialDetails{URL: "https://b2.connect-server:3939/connect", ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty URL":                    CreateCredentialDetails{Name: "newcred", ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"empty creds":                  CreateCredentialDetails{Name: "newcred", URL: "https://b2.connect-server:3939/connect"},
		"partial Connect Cloud cred 1": CreateCredentialDetails{Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccountName: "friedtofu"},
		"partial Connect Cloud cred 2": CreateCredentialDetails{Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccountID: "1234"},
		"partial Connect Cloud cred 3": CreateCredentialDetails{Name: "newcred", URL: "https://b2.connect-server:3939/connect", AccessToken: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
		"partial Connect Cloud cred 4": CreateCredentialDetails{Name: "newcred", URL: "https://b2.connect-server:3939/connect", RefreshToken: "abcdeC2aqbh7dg8TO43XPu7r56YDh002"},
	}

	for _, createCredDetails := range testCases {
		_, err := createCredDetails.ToCredential()
		s.Error(err)
		s.Equal("New credentials require non-empty Name, URL, Server Type, and either API Key, Snowflake, or Connect Cloud connection fields", err.Error())
	}
}
