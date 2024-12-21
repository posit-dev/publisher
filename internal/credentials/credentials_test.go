// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"errors"
	"testing"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
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
		GUID:   "18cd5640-bee5-4b2a-992a-a2725ab6103d",
		Name:   "friedtofu",
		URL:    "https://a1.connect-server:3939/connect",
		ApiKey: "abcdeC2aqbh7dg8TO43XPu7r56YDh000",
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
	s.log.On("Debug", "Fallback to file managed credentials service due to unavailable system keyring").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NoError(err)
	s.Implements((*CredentialsService)(nil), credservice)
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_KeyringResetsOnCorruptedCred() {
	keyring.MockInit()

	corruptedData := `{"":{"guid":"18cd5640-bee5-4b2a-992a-a2725ab6103d","version":0,"data":"unrecognizbledata"}}`
	keyring.Set(ServiceName, "credentials", corruptedData)

	keyringCorruptedSave, err := keyring.Get(ServiceName, "credentials")
	s.NoError(err)
	s.Equal(keyringCorruptedSave, corruptedData)

	s.log.On("Warn", "Corrupted credentials data found. A reset was applied to stored data to be able to proceed").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NotNil(err)
	s.Implements((*CredentialsService)(nil), credservice)

	// Confirm agent error of corrupted credential bubbles up to warn the user
	_, isCorruptedErr := types.IsAgentErrorOf(err, types.ErrorCredentialCorruptedReset)
	s.True(isCorruptedErr)

	keyringUpdatedData, err := keyring.Get(ServiceName, "credentials")
	s.NoError(err)
	s.Equal(keyringUpdatedData, "{}")
}

func (s *CredentialsServiceTestSuite) TestNewCredentialsService_FallbackFileResetsOnCorruptedCred() {
	// Use an in memory filesystem for this test
	// avoiding to manipulate users ~/.connect-credentials
	fsys = afero.NewMemMapFs()
	defer func() { fsys = afero.NewOsFs() }()
	dirPath, err := util.UserHomeDir(fsys)
	s.NoError(err)

	dirPath = dirPath.Join(".connect-credentials")
	corruptedContents := []byte("unrecognizable_key = this is bad")
	err = afero.WriteFile(fsys, dirPath.String(), corruptedContents, 0644)
	s.NoError(err)

	keyringErr := errors.New("this is a teapot, unsupported system")
	keyring.MockInitWithError(keyringErr)

	// Verify the corrupted contents are in
	credsData, err := afero.ReadFile(fsys, dirPath.String())
	s.NoError(err)
	s.Equal(credsData, corruptedContents)

	s.log.On("Debug", "System keyring service is not available", "error", "failed to load credentials: this is a teapot, unsupported system").Return()
	s.log.On("Debug", "Fallback to file managed credentials service due to unavailable system keyring").Return()
	s.log.On("Warn", "Corrupted credentials data found. A reset was applied to stored data to be able to proceed").Return()

	credservice, err := NewCredentialsService(s.log)
	s.NotNil(err)
	s.Implements((*CredentialsService)(nil), credservice)

	// Confirm agent error of corrupted credential bubbles up to warn the user
	_, isCorruptedErr := types.IsAgentErrorOf(err, types.ErrorCredentialCorruptedReset)
	s.True(isCorruptedErr)

	credsData, err = afero.ReadFile(fsys, dirPath.String())
	s.NoError(err)
	s.Equal(credsData, []byte("[credentials]\n"))
}
