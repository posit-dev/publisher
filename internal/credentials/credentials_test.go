// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/zalando/go-keyring"
)

func TestSet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
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
	_, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	_, err = cs.Set("example", "https://example.com", "12345")
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)
}

func TestGet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}

	// error if missing
	_, err := cs.Get("example")
	assert.Error(t, err)

	// pass if exists
	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)
	res, err := cs.Get(cred.GUID)
	assert.NoError(t, err)
	assert.Equal(t, res, cred)

}

func TestDelete(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	cred, err := cs.Set("example", "https://example.com", "12345")
	assert.NoError(t, err)

	// no error if exists
	err = cs.Delete(cred.GUID)
	assert.NoError(t, err)

	// err if missing
	err = cs.Delete(cred.GUID)
	assert.Error(t, err)
}
