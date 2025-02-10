// Package credentials provides a secure storage and management system for user credentials.
// The service uses the "go-keyring" library to interact with the system's native keyring service.
// For systems that do not support a native keyring service,
// an alternative using a file at ~/.connect-credentials to persist credentials is implemented.
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
// - CredentialsService (interface): A service that provides methods for managing credentials.
//   - keyringCredentialsService: The service using the system's native keyring.
//   - fileCredentialsService: Fallback service for persising credentials in file when keyring is not available.
//
// Author: Posit Software, PBC
// Copyright (C) 2024 by Posit Software, PBC.
package credentials

import (
	"encoding/json"

	"github.com/posit-dev/publisher/internal/logging"
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

func (c *Credential) ConflictCheck(compareWith Credential) error {
	if compareWith.URL == c.URL {
		return NewURLCollisionError(c.Name, c.URL)
	}
	if compareWith.Name == c.Name {
		return NewNameCollisionError(c.Name, c.URL)
	}
	return nil
}

type CredentialRecord struct {
	GUID    string          `json:"guid"`
	Version uint            `json:"version"`
	Data    json.RawMessage `json:"data"`
}

type CredentialTable = map[string]CredentialRecord

var UseKeychain bool = true

// ToCredential converts a CredentialRecord to a Credential based on its version.
func (cr *CredentialRecord) ToCredential() (*Credential, error) {
	switch cr.Version {
	case 0:
		var cred CredentialV0
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		return &cred, nil
	default:
		return nil, NewVersionError(cr.Version)
	}
}

type CredServiceFactory = func(log logging.Logger) (CredentialsService, error)

type CredentialsService interface {
	Delete(guid string) error
	Get(guid string) (*Credential, error)
	List() ([]Credential, error)
	Set(name string, url string, ak string) (*Credential, error)
	Reset() (string, error)
}

// The main credentials service constructor that determines if the system's keyring is available to be used,
// if not, returns a file based credentials service.
func NewCredentialsService(log logging.Logger) (CredentialsService, error) {
	var fcService *fileCredentialsService = nil

	if UseKeychain {
		krService := NewKeyringCredentialsService(log)
		if krService.IsSupported() {
			log.Debug("Using keychain for credential storage.")
			return krService, nil
		}
		log.Debug("Fallback to file managed credentials service due to unavailable system keyring.")
	} else {
		log.Debug("Configuration has disabled keychain credentials. Using file managed credentials instead.")
	}

	fcService, err := NewFileCredentialsService(log)
	if err != nil {
		return fcService, err
	}

	return fcService, nil
}
