// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

	cred, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)
	s.NotNil(cred.GUID)
	s.Equal(cred.Name, "example")
	s.Equal(cred.URL, "https://example.com")
	s.Equal(cred.ApiKey, "12345")
}

func (s *KeyringCredentialsTestSuite) TestSetURLCollisionError() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	_, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)
	_, err = cs.Set("example", "https://example.com", "12345")
	s.Error(err)
	s.IsType(&URLCollisionError{}, err)
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
	cred, err := cs.Set("example", "https://example.com", "12345")
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
	cred, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)
	res, err := cs.Get(cred.GUID)
	s.NoError(err)
	s.Equal(res.URL, cred.URL)

	// pass if URL ends up normalized
	cred, err = cs.Set("example2", "https://example.com///another/seg/", "12345")
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
	_, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)

	// name collision
	_, err = cs.Set("example", "https://more_examples.com", "12345")
	s.Error(err)
	s.IsType(&NameCollisionError{}, err)

	// URL collision
	_, err = cs.Set("another_example", "https://example.com", "12345")
	s.Error(err)
	s.IsType(&URLCollisionError{}, err)
}

func (s *KeyringCredentialsTestSuite) TestList() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	creds, err := cs.List()
	s.NoError(err)
	s.Equal(creds, []Credential{})

	// Add a couple creds to be assert on the list again
	nc1, err := cs.Set("example", "https://a.example.com", "12345")
	s.NoError(err)
	nc2, err := cs.Set("example2", "https://b.example.com", "12345")
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

	cred, err := cs.Set("example", "https://example.com", "12345")
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

func (s *KeyringCredentialsTestSuite) TestReset() {
	cs := keyringCredentialsService{
		log: s.log,
	}

	creds, err := cs.List()
	s.NoError(err)
	s.Equal(creds, []Credential{})

	// Add a couple creds to be assert on the list again
	_, err = cs.Set("example", "https://a.example.com", "12345")
	s.NoError(err)
	_, err = cs.Set("example2", "https://b.example.com", "12345")
	s.NoError(err)

	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 2)

	// Expected Log Warn
	s.log.On("Warn", "Corrupted credentials data found. A reset was applied to stored data to be able to proceed.", "credentials_service", "keyring").Return()

	err = cs.Reset()
	s.NoError(err)

	// Creds wiped out
	creds, err = cs.List()
	s.NoError(err)
	s.Len(creds, 0)
}
