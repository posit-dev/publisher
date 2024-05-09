// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/zalando/go-keyring"
)

const ServiceName = "Posit Publisher Safe Storage"

const CurrentVersion = 0

type Credential struct {
	GUID   string `json:"guid"`
	Name   string `json:"name"`
	URL    string `json:"url"`
	ApiKey string `json:"apiKey"`
}

type CredentialV0 = Credential

type CredentialV1 struct {
	// not implemented
	//
	// When a migration is needed, take the following steps:
	// 1. modify the credential schema to include what needs to be changed/
	// 2. set this equal to credential (.e.g, CredentialV1 = Credential)
	// 3. Update CurrentVersion to 1
	// 4. In ToCredential below, add a case statement for version 1. This should be a generic Umarshal
	// 5. Modify case 0 to map CredentialV0 to CredentialV1
	// 6. Go ahead and setup CredentialV2 with these instructions.
}

type CredentialRecord struct {
	GUID    string          `json:"guid"`
	Version uint            `json:"version"`
	Data    json.RawMessage `json:"data"`
}

func (cr *CredentialRecord) ToCredential() (*Credential, error) {
	switch cr.Version {
	case 0:
		var cred CredentialV0
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, &CorruptedError{GUID: cr.GUID}
		}
		return &cred, nil
	default:
		return nil, &VersionError{Version: cr.Version}
	}
}

type CredentialsService struct{}

func (cs *CredentialsService) Load() (map[string]CredentialRecord, error) {
	data, err := keyring.Get(ServiceName, "credentials")
	if err != nil {
		if err == keyring.ErrNotFound {
			return make(map[string]CredentialRecord), nil
		}
		return nil, &LoadError{Err: err}
	}

	var creds map[string]CredentialRecord
	err = json.Unmarshal([]byte(data), &creds)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	return creds, nil
}

func (cs *CredentialsService) List() ([]Credential, error) {
	records, err := cs.Load()
	if err != nil {
		return nil, err
	}
	var creds []Credential = make([]Credential, 0)
	for _, cr := range records {
		cred, err := cr.ToCredential()
		if err != nil {
			return nil, err
		}
		creds = append(creds, *cred)
	}
	return creds, nil
}

func (cs *CredentialsService) Set(name string, url string, ak string) (*Credential, error) {
	creds, err := cs.Load()
	if err != nil {
		return nil, err
	}

	// Check if URL is already used by another credential
	for guid, cr := range creds {
		cred, err := cr.ToCredential()
		if err != nil {
			return nil, &CorruptedError{GUID: guid}
		}
		if cred.URL == url {
			return nil, &URLCollisionError{URL: url}
		}
	}

	guid := uuid.New().String()
	cred := Credential{
		GUID:   guid,
		Name:   name,
		URL:    url,
		ApiKey: ak,
	}

	raw, err := json.Marshal(cred)
	if err != nil {
		return nil, fmt.Errorf("error marshalling credential: %v", err)
	}

	creds[guid] = CredentialRecord{
		GUID:    guid,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw),
	}

	err = cs.save(creds)
	if err != nil {
		return nil, err
	}

	return &cred, nil
}

func (cs *CredentialsService) Get(guid string) (*Credential, error) {
	creds, err := cs.Load()
	if err != nil {
		return nil, err
	}

	cr, exists := creds[guid]
	if !exists {
		return nil, &NotFoundError{GUID: guid}
	}

	return cr.ToCredential()
}

func (cs *CredentialsService) Delete(guid string) error {
	creds, err := cs.Load()
	if err != nil {
		return err
	}

	_, exists := creds[guid]
	if !exists {
		return &NotFoundError{GUID: guid}
	}

	delete(creds, guid)
	return cs.save(creds)
}

func (cs *CredentialsService) save(creds map[string]CredentialRecord) error {
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
