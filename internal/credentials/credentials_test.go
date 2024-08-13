// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/assert"
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

func credentialsFilePath(afs afero.Fs) (util.AbsolutePath, error) {
	homeDir, err := util.UserHomeDir(afs)
	if err != nil {
		return util.AbsolutePath{}, err
	}
	return homeDir.Join(".connect-credentials"), nil
}

func createFileCredentials(t *testing.T, cs *CredentialsService, errorCheck bool) {
	path, err := credentialsFilePath(cs.afs)
	assert.NoError(t, err)

	f, err := path.Create()
	assert.NoError(t, err)
	defer f.Close()

	enc := toml.NewEncoder(f)
	cred := fileCredential{
		URL: fileCred.URL,
		Key: fileCred.ApiKey,
	}
	err = enc.Encode(cred)
	assert.NoError(t, err)

	if errorCheck {
		res, err := cs.Get(fileCred.GUID)
		assert.NoError(t, err)
		expected := Credential{
			GUID:   fileCred.GUID,
			Name:   fileCred.Name,
			URL:    fileCred.URL,
			ApiKey: fileCred.ApiKey,
		}
		assert.Equal(t, res, &expected)
	}
}

func clearFileCredentials(t *testing.T, cs *CredentialsService) {
	path, err := credentialsFilePath(cs.afs)
	assert.NoError(t, err)
	_ = path.Remove()
}

func TestSet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}
	clearFileCredentials(t, &cs)

	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	assert.NotNil(t, cred.GUID)
	assert.Equal(t, cred.Name, "example")
	assert.Equal(t, cred.URL, "https://example.com")
	assert.Equal(t, cred.ApiKey, "12345")
}

func TestSetURLCollisionError(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}
	clearFileCredentials(t, &cs)

	_, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	_, err = cs.Set("example", "https://example.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)

	// validate collision with env var credentials
	createFileCredentials(t, &cs, true)

	_, err = cs.Set("unique", fileCred.URL, "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvURLCollisionError{}, err)
}

func TestGet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}
	clearFileCredentials(t, &cs)

	// First test without any credentials in environment

	// error if missing
	_, err := cs.Get("example")
	assert.Error(t, err)

	// pass if exists
	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	res, err := cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, cred)

	// confirm environment credential not available
	_, err = cs.Get(fileCred.GUID)
	assert.Error(t, err)

	// Test with credentials in environment
	createFileCredentials(t, &cs, true)

	// retest prior test
	res, err = cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, cred)

	// request environment credentials
	res, err = cs.Get(fileCred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, &fileCred)

	// Test for conflicts where credential was saved ahead of env variable
	clearFileCredentials(t, &cs)
	cred, err = cs.Set("env", fileCred.URL, "12345")
	assert.NoError(t, err)
	_, err = cs.Get(cred.GUID)
	assert.NoError(t, err)

	createFileCredentials(t, &cs, false)
	_, err = cs.Get(cred.GUID)
	assert.Error(t, err)
	assert.IsType(t, &EnvURLCollisionError{}, err)
}

func TestNormalizedSet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}
	clearFileCredentials(t, &cs)

	// pass if no change (already normalized)
	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	res, err := cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res.URL, cred.URL)

	// pass if URL ends up normalized
	cred, err = cs.Set("example2", "https://example.com///another/seg/", "12345")
	assert.NoError(t, err)
	assert.NotEqual(t, cred.URL, "https://example.com///another/seg/")

	res, err = cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res.URL, "https://example.com/another/seg")
	assert.Equal(t, cred.URL, res.URL)
}

func TestSetCollisions(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}

	// Add credentials into environment
	createFileCredentials(t, &cs, true)

	// add a non-environment credential
	_, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)

	// non-environment name collision
	_, err = cs.Set("example", "https://more_examples.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &NameCollisionError{}, err)

	// environment name collision
	_, err = cs.Set(fileCred.Name, "https://more_examples2.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvNameCollisionError{}, err)

	// non-environment URL collision
	_, err = cs.Set("another_example", "https://example.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)

	// environment URL collision
	_, err = cs.Set("one_more", fileCred.URL, "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvURLCollisionError{}, err)
}

func TestDelete(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{
		afs: afero.NewMemMapFs(),
	}
	clearFileCredentials(t, &cs)

	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)

	// no error if exists
	err = cs.Delete(cred.GUID)
	assert.NoError(t, err)

	// err if missing
	err = cs.Delete(cred.GUID)
	assert.Error(t, err)

	// Add credentials into environment
	createFileCredentials(t, &cs, true)

	// err for our special GUID
	err = cs.Delete(fileCred.GUID)
	assert.Error(t, err)
	assert.IsType(t, &EnvURLDeleteError{}, err)
}
