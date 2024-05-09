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
	cred := Credential{Name: "example", URL: "https://example.com", ApiKey: "example"}
	err := cs.Set(cred)
	assert.NoError(t, err)
}

func TestSetURLCollisionError(t *testing.T) {
	keyring.MockInit()
	url := "https://example.com"
	cs := CredentialsService{}
	err := cs.Set(Credential{Name: "original", URL: url, ApiKey: "example"})
	assert.NoError(t, err)
	err = cs.Set(Credential{Name: "duplicate", URL: url, ApiKey: "example"})
	assert.Error(t, err)
	assert.IsType(t, &URLCollisionError{}, err)
}

func TestGet(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	cred := Credential{Name: "example", URL: "https://example.com", ApiKey: "example"}

	// error if missing
	_, err := cs.Get("example")
	assert.Error(t, err)

	// pass if exists
	err = cs.Set(cred)
	assert.NoError(t, err)
	res, err := cs.Get("example")
	assert.NoError(t, err)
	assert.Equal(t, *res, cred)

}

func TestDelete(t *testing.T) {
	keyring.MockInit()
	cs := CredentialsService{}
	cred := Credential{Name: "example", URL: "https://example.com", ApiKey: "example"}
	err := cs.Set(cred)
	assert.NoError(t, err)

	// no error if exists
	err = cs.Delete("example")
	assert.NoError(t, err)

	// err if missing
	err = cs.Delete("example")
	assert.Error(t, err)
}
