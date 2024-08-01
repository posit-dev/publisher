// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/zalando/go-keyring"
)

type Cred struct {
	GUID   string
	Server string
	ApiKey string
	Name   string
}

var environmentCred = Credential{
	GUID:   "00000000-0000-0000-0000-000000000000",
	URL:    "https://connect.localtest.me/rsc/dev-password-copy",
	ApiKey: "3456789",
	Name:   "dev-password-copy",
}

func initializeEnv(t *testing.T, cs *CredentialsService) {
	t.Setenv("CONNECT_SERVER", environmentCred.URL)
	t.Setenv("CONNECT_API_KEY", environmentCred.ApiKey)
	t.Setenv("CONNECT_SERVER_NAME", environmentCred.Name)

	res, err := cs.Get(environmentCred.GUID)
	assert.NoError(t, err)
	expected := Credential{
		GUID:   environmentCred.GUID,
		Name:   environmentCred.Name,
		URL:    environmentCred.URL,
		ApiKey: environmentCred.ApiKey,
	}
	assert.Equal(t, res, &expected)
}

func clearEnv(t *testing.T) {
	t.Setenv("CONNECT_SERVER", "")
	t.Setenv("CONNECT_API_KEY", "")
	t.Setenv("CONNECT_SERVER_NAME", "")
}

func TestSet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	clearEnv(t)

	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	assert.NotNil(t, cred.GUID)
	assert.Equal(t, cred.Name, "example")
	assert.Equal(t, cred.URL, "https://example.com")
	assert.Equal(t, cred.ApiKey, "12345")
}

func TestSetURLCollisionError(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	clearEnv(t)

	_, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	_, err = cs.Set("example", "https://example.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)

	// validate collision with env var credentials
	initializeEnv(t, &cs)

	_, err = cs.Set("unique", environmentCred.URL, "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvURLCollisionError{}, err)
}

func TestGet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	clearEnv(t)

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

	// Test with credentials in environment
	initializeEnv(t, &cs)

	// retest prior test
	res, err = cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, cred)

	// request environment credentials
	res, err = cs.Get(environmentCred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, &environmentCred)
}

func TestNormalizedSet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	clearEnv(t)

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
	cs := CredentialsService{}

	// Add credentials into environment
	initializeEnv(t, &cs)

	// add a non-environment credential
	_, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)

	// non-environment name collision
	_, err = cs.Set("example", "https://more_examples.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &NameCollisionError{}, err)

	// environment name collision
	_, err = cs.Set(environmentCred.Name, "https://more_examples2.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvNameCollisionError{}, err)

	// non-environment URL collision
	_, err = cs.Set("another_example", "https://example.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)

	// environment URL collision
	_, err = cs.Set("one_more", environmentCred.URL, "12345")
	assert.Error(t, err)
	assert.IsType(t, &EnvURLCollisionError{}, err)
}

func TestDelete(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	clearEnv(t)

	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)

	// no error if exists
	err = cs.Delete(cred.GUID)
	assert.NoError(t, err)

	// err if missing
	err = cs.Delete(cred.GUID)
	assert.Error(t, err)

	// Add credentials into environment
	initializeEnv(t, &cs)

	// err for our special GUID
	err = cs.Delete(environmentCred.GUID)
	assert.Error(t, err)
	assert.IsType(t, &EnvURLDeleteError{}, err)
}
