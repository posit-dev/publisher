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
	assert.Equal(t, res, cred)

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
