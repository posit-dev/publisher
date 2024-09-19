// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/logging/loggingtest"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
)

type Cred struct {
	GUID   string
	Server string
	ApiKey string
	Name   string
}

var fileCred = Credential{
	GUID:   "00000000-0000-0000-0000-000000000000",
	URL:    "https://connect.localtest.me/rsc/dev-password-copy",
	ApiKey: "3456789",
	Name:   "connect.localtest.me",
}

type CredentialsTestSuite struct {
	utiltest.Suite
	log *loggingtest.MockLogger
}

func TestCredentialsTestSuite(t *testing.T) {
	suite.Run(t, new(CredentialsTestSuite))
}

func (s *CredentialsTestSuite) SetupTest() {
	s.log = loggingtest.NewMockLogger()
}

func (s *CredentialsTestSuite) credentialsFilePath(afs afero.Fs) (util.AbsolutePath, error) {
	homeDir, err := util.UserHomeDir(afs)
	if err != nil {
		return util.AbsolutePath{}, err
	}
	return homeDir.Join(".connect-credentials"), nil
}

func (s *CredentialsTestSuite) createFileCredentials(cs *credentialsService, errorCheck bool) {
	path, err := s.credentialsFilePath(cs.afs)
	s.NoError(err)

	f, err := path.Create()
	s.NoError(err)
	defer f.Close()

	enc := toml.NewEncoder(f)
	cred := fileCredential{
		URL: fileCred.URL,
		Key: fileCred.ApiKey,
	}
	err = enc.Encode(cred)
	s.NoError(err)

	if errorCheck {
		res, err := cs.Get(fileCred.GUID)
		s.NoError(err)
		expected := Credential{
			GUID:   fileCred.GUID,
			Name:   fileCred.Name,
			URL:    fileCred.URL,
			ApiKey: fileCred.ApiKey,
		}
		s.Equal(res, &expected)
	}
}

func (s *CredentialsTestSuite) clearFileCredentials(cs *credentialsService) {
	path, err := s.credentialsFilePath(cs.afs)
	s.NoError(err)
	_ = path.Remove()
}

func (s *CredentialsTestSuite) TestSet() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}
	s.clearFileCredentials(&cs)

	cred, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)
	s.NotNil(cred.GUID)
	s.Equal(cred.Name, "example")
	s.Equal(cred.URL, "https://example.com")
	s.Equal(cred.ApiKey, "12345")
}

func (s *CredentialsTestSuite) TestSetURLCollisionError() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}
	s.clearFileCredentials(&cs)

	_, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)
	_, err = cs.Set("example", "https://example.com", "12345")
	s.Error(err)
	s.IsType(&URLCollisionError{}, err)

	// validate collision with env var credentials
	s.createFileCredentials(&cs, true)

	_, err = cs.Set("unique", fileCred.URL, "12345")
	s.Error(err)
	s.IsType(&EnvURLCollisionError{}, err)
}

func (s *CredentialsTestSuite) TestGet() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}
	s.clearFileCredentials(&cs)
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

	// confirm environment credential not available
	s.log.On("Debug", "Credential does not exist", "credential", fileCred.GUID).Return()
	_, err = cs.Get(fileCred.GUID)
	s.Error(err)
	s.log.AssertExpectations(s.T())

	// Test with credentials in environment
	s.createFileCredentials(&cs, true)

	// retest prior test
	res, err = cs.Get(cred.GUID)
	s.NoError(err)
	s.Equal(res, cred)

	// request environment credentials
	res, err = cs.Get(fileCred.GUID)
	s.NoError(err)
	s.Equal(res, &fileCred)

	// Test for conflicts where credential was saved ahead of env variable
	s.clearFileCredentials(&cs)
	cred, err = cs.Set("env", fileCred.URL, "12345")
	s.NoError(err)
	_, err = cs.Get(cred.GUID)
	s.NoError(err)

	s.log.On("Debug", "Conflict on credential record", "error", "CONNECT_SERVER URL value conflicts with existing credential (connect.localtest.me) URL: https://connect.localtest.me/rsc/dev-password-copy").Return()
	s.createFileCredentials(&cs, false)
	_, err = cs.Get(cred.GUID)
	s.Error(err)
	s.IsType(&EnvURLCollisionError{}, err)
	s.log.AssertExpectations(s.T())
}

func (s *CredentialsTestSuite) TestNormalizedSet() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}
	s.clearFileCredentials(&cs)

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

func (s *CredentialsTestSuite) TestSetCollisions() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}

	// Add credentials into environment
	s.createFileCredentials(&cs, true)

	// add a non-environment credential
	_, err := cs.Set("example", "https://example.com", "12345")
	s.NoError(err)

	// non-environment name collision
	_, err = cs.Set("example", "https://more_examples.com", "12345")
	s.Error(err)
	s.IsType(&NameCollisionError{}, err)

	// environment name collision
	_, err = cs.Set(fileCred.Name, "https://more_examples2.com", "12345")
	s.Error(err)
	s.IsType(&EnvNameCollisionError{}, err)

	// non-environment URL collision
	_, err = cs.Set("another_example", "https://example.com", "12345")
	s.Error(err)
	s.IsType(&URLCollisionError{}, err)

	// environment URL collision
	_, err = cs.Set("one_more", fileCred.URL, "12345")
	s.Error(err)
	s.IsType(&EnvURLCollisionError{}, err)
}

func (s *CredentialsTestSuite) TestDelete() {
	keyring.MockInit()
	cs := credentialsService{
		afs: afero.NewMemMapFs(),
		log: s.log,
	}
	s.clearFileCredentials(&cs)

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

	// Add credentials into environment
	s.createFileCredentials(&cs, true)

	// err for our special GUID
	err = cs.Delete(fileCred.GUID)
	s.Error(err)
	s.IsType(&EnvURLDeleteError{}, err)
}
