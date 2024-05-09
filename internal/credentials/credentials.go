// Copyright (C) 2024 by Posit Software, PBC.

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

type LoadError struct {
	Err error
}

func (e *LoadError) Error() string {
	return fmt.Sprintf("failed to load credentials: %v", e.Err)
}

type NotFoundError struct {
	Name string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("credential not found: %s", e.Name)
}

// URL is used by another credential
type URLCollisionError struct {
	URL string
}

func (e *URLCollisionError) Error() string {
	return fmt.Sprintf("URL already in use: %s", e.URL)
}

func (cs *CredentialsService) Load() (map[string]Credential, error) {
	data, err := keyring.Get(ServiceName, "credentials")
	if err != nil {
		if err == keyring.ErrNotFound {
			return make(map[string]Credential), nil
		}
		return nil, &LoadError{Err: err}
	}

	var creds map[string]Credential
	err = json.Unmarshal([]byte(data), &creds)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	return creds, nil
}

func (cs *CredentialsService) Set(cred Credential) error {
	creds, err := cs.Load()
	if err != nil {
		return err
	}

	// Check if URL is already used by another credential
	for name, value := range creds {
		if value.URL == cred.URL && name != cred.Name {
			return &URLCollisionError{URL: cred.URL}
		}
	}

	creds[cred.Name] = cred
	return cs.save(creds)
}

func (cs *CredentialsService) Get(name string) (*Credential, error) {
	creds, err := cs.Load()
	if err != nil {
		return nil, err
	}

	cred, exists := creds[name]
	if !exists {
		return nil, &NotFoundError{Name: name}
	}

	return &cred, nil
}

func (cs *CredentialsService) Delete(name string) error {
	creds, err := cs.Load()
	if err != nil {
		return err
	}

	_, exists := creds[name]
	if !exists {
		return &NotFoundError{Name: name}
	}

	delete(creds, name)
	return cs.save(creds)
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
