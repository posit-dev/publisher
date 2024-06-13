package credentials

import (
	"strings"

	"github.com/zalando/go-keyring"
)

type KeyringService struct {
	keyring.Keyring
}

func (ks *KeyringService) Set(service, user, password string) error {
	err := keyring.Set(service, user, password)
	if err != nil {
		if strings.HasSuffix(err.Error(), "exec: \"dbus-launch\": executable file not found in $PATH") {
			keyring.MockInit()
			return keyring.Set(service, user, password)
		}
	}
	return err
}

func (ks *KeyringService) Get(service, user string) (string, error) {
	v, err := keyring.Get(service, user)
	if err != nil {
		if strings.HasSuffix(err.Error(), "exec: \"dbus-launch\": executable file not found in $PATH") {
			keyring.MockInit()
			return keyring.Get(service, user)
		}
	}
	return v, err
}

func (ks *KeyringService) Delete(service, user string) error {
	err := keyring.Delete(service, user)
	if err != nil {
		if strings.HasSuffix(err.Error(), "exec: \"dbus-launch\": executable file not found in $PATH") {
			keyring.MockInit()
			return keyring.Delete(service, user)
		}
	}
	return err
}
