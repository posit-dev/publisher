// Package credentials provides a secure storage and management system for user credentials.
// The service uses the "go-keyring" library to interact with the system's native keyring service.
//
// This package is not thread safe! Manipulation of credentials from multiple threads can result in data loss.
// A distributed write lock is required to ensure threads do not overwrite the credential store.
//
// Support for breaking changes to the Credentials schema is supported via version system.
// The current implementation supports a single version (Version 0), but is designed to be extendable to future versions.
// For example, adding a new field to Credential.
//
// Migration instructions:
// - Modify the current version to retain the current Credential structure (i.e., copy the struct of Credential to CredentialV0)
// - Modify Credential to include required changes.
// - Create a new version (e.g., CredentialV1) and assign Credential to it (.e.g, CredentialV1 = Credential)
// - Increment CurrentVersion to match the new version (e.g., CredentialVersion = 1)
// - Add a case statement for the new version to ToCredential.
// - Modify the existing ToCredential implementation to accommodate changes to Credential.
//
// Key components include:
// - Credential: The main structure representing a single credential.
// - CredentialRecord: A structure for storing credential data along with its version for future compatibility.
// - CredentialsService: A service that provides methods for managing credentials.
//
// Author: Posit Software, PBC
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

type CredentialRecord struct {
	GUID    string          `json:"guid"`
	Version uint            `json:"version"`
	Data    json.RawMessage `json:"data"`
}

type CredentialTable = map[string]CredentialRecord

// ToCredential converts a CredentialRecord to a Credential based on its version.
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

// Delete removes a Credential by its guid.
// If lookup by guid fails, a NotFoundError is returned.
func (cs *CredentialsService) Delete(guid string) error {
	table, err := cs.load()
	if err != nil {
		return err
	}

	_, exists := table[guid]
	if !exists {
		return &NotFoundError{GUID: guid}
	}

	delete(table, guid)
	return cs.save(table)
}

// Get retrieves a Credential by its guid.
func (cs *CredentialsService) Get(guid string) (*Credential, error) {
	table, err := cs.load()
	if err != nil {
		return nil, err
	}

	cr, exists := table[guid]
	if !exists {
		return nil, &NotFoundError{GUID: guid}
	}

	return cr.ToCredential()
}

// List retrieves all Credentials
func (cs *CredentialsService) List() ([]Credential, error) {
	records, err := cs.load()
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

// Set creates a Credential.
// A guid is assigned to the Credential using the UUIDv4 specification.
func (cs *CredentialsService) Set(name string, url string, ak string) (*Credential, error) {
	table, err := cs.load()
	if err != nil {
		return nil, err
	}

	// Check if URL is already used by another credential
	for guid, record := range table {
		cred, err := record.ToCredential()
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

	table[guid] = CredentialRecord{
		GUID:    guid,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw),
	}

	err = cs.save(table)
	if err != nil {
		return nil, err
	}

	return &cred, nil
}

// Saves the CredentialTable
func (cs *CredentialsService) save(table CredentialTable) error {
	data, err := json.Marshal(table)
	if err != nil {
		return fmt.Errorf("failed to serialize credentials: %v", err)
	}

	err = keyring.Set(ServiceName, "credentials", string(data))
	if err != nil {
		return fmt.Errorf("failed to set credentials: %v", err)
	}
	return nil
}

// Loads the CredentialTable
func (cs *CredentialsService) load() (CredentialTable, error) {
	data, err := keyring.Get(ServiceName, "credentials")
	if err != nil {
		if err == keyring.ErrNotFound {
			return make(map[string]CredentialRecord), nil
		}
		return nil, &LoadError{Err: err}
	}

	var table CredentialTable
	err = json.Unmarshal([]byte(data), &table)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	return table, nil
}
