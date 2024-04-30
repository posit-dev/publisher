package credentials

import (
	"encoding/json"
	"fmt"

	"github.com/zalando/go-keyring"
)

const ServiceName = "Posit Publisher Safe Storage"

type Credential struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	ApiKey string `json:"apiKey"`
}

type CredentialsService struct{}

func (cs *CredentialsService) Load() (map[string]Credential, error) {
	data, err := keyring.Get(ServiceName, "credentials")
	if err != nil {
		if err == keyring.ErrNotFound {
			return make(map[string]Credential), nil
		}
		return nil, fmt.Errorf("failed to get credentials: %v", err)
	}

	var creds map[string]Credential
	err = json.Unmarshal([]byte(data), &creds)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	return creds, nil
}

func (cs *CredentialsService) save(creds map[string]Credential) error {
	data, err := json.Marshal(creds)
	if err != nil {
		return fmt.Errorf("failed to serialize credentials: %v", err)
	}

	err = keyring.Set(ServiceName, "credentials", string(data))
	if err != nil {
		return fmt.Errorf("failed to set credentials: %v", err)
	}
	return nil
}

func (cs *CredentialsService) Set(cred Credential) error {
	creds, err := cs.Load()
	if err != nil {
		return err
	}

	creds[cred.Name] = cred
	return cs.save(creds)
}

func (cs *CredentialsService) Get(name string) (Credential, error) {
	creds, err := cs.Load()
	if err != nil {
		return Credential{}, err
	}

	cred, exists := creds[name]
	if !exists {
		return Credential{}, fmt.Errorf("credential not found")
	}
	return cred, nil
}

func (cs *CredentialsService) Delete(name string) error {
	creds, err := cs.Load()
	if err != nil {
		return err
	}

	_, exists := creds[name]
	if !exists {
		return fmt.Errorf("credential not found")
	}

	delete(creds, name)
	return cs.save(creds)
}
