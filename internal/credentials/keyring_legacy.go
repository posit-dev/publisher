// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"encoding/json"
	"fmt"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/zalando/go-keyring"
)

// legacyKeyringCredentialsService implements the CredentialsService interface for
// legacy keyring format that stored all credentials in a single keyring entry.
// This service is used primarily for migrating from the old format to the new one.
type legacyKeyringCredentialsService struct {
	log logging.Logger
}

// NewLegacyKeyringCredentialsService creates a new instance of legacyKeyringCredentialsService
func NewLegacyKeyringCredentialsService(log logging.Logger) *legacyKeyringCredentialsService {
	return &legacyKeyringCredentialsService{
		log: log,
	}
}

// IsSupported checks if the legacy keyring format is available on the system
func (lks *legacyKeyringCredentialsService) IsSupported() bool {
	// Check if we can access the legacy credentials entry
	_, err := keyring.Get(ServiceName, LegacyKey)
	return err == nil
}

// Delete is not fully supported in legacy format
func (lks *legacyKeyringCredentialsService) Delete(guid string) error {
	// For legacy, we don't support individual deletion
	return fmt.Errorf("individual credential deletion not supported in legacy format")
}

// Get is not fully supported in legacy format
func (lks *legacyKeyringCredentialsService) Get(guid string) (*Credential, error) {
	// For legacy, we don't support individual get
	return nil, fmt.Errorf("individual credential get not supported in legacy format")
}

// List retrieves all credentials from the legacy keyring format
func (lks *legacyKeyringCredentialsService) List() ([]Credential, error) {
	table, err := lks.loadLegacy()
	if err != nil {
		return nil, err
	}

	var creds []Credential = make([]Credential, 0)
	for _, cr := range table {
		cred, err := cr.ToCredential()
		if err != nil {
			return nil, err
		}
		creds = append(creds, *cred)
	}
	return creds, nil
}

// Set and ForceSet is not supported in legacy format
func (lks *legacyKeyringCredentialsService) Set(credDetails CreateCredentialDetails) (*Credential, error) {
	// Legacy service doesn't support setting new credentials
	return nil, fmt.Errorf("setting credentials not supported in legacy format")
}

func (ks *legacyKeyringCredentialsService) ForceSet(credDetails CreateCredentialDetails) (*Credential, error) {
	return nil, fmt.Errorf("force setting credentials not supported in legacy format")
}

// Reset deletes the legacy keyring entry
func (lks *legacyKeyringCredentialsService) Reset() (string, error) {
	// Delete the legacy credentials entry
	err := keyring.Delete(ServiceName, LegacyKey)
	if err != nil && err != keyring.ErrNotFound {
		return "", fmt.Errorf("failed to delete legacy credentials: %v", err)
	}
	return "", nil
}

// loadLegacy loads credentials from the legacy single-entry format
func (lks *legacyKeyringCredentialsService) loadLegacy() (CredentialTable, error) {
	data, err := keyring.Get(ServiceName, LegacyKey)
	if err != nil {
		if err == keyring.ErrNotFound {
			// No legacy credentials found
			return make(CredentialTable), nil
		}
		return nil, fmt.Errorf("failed to load legacy credentials: %v", err)
	}

	var table CredentialTable
	err = json.Unmarshal([]byte(data), &table)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize legacy credentials: %v", err)
	}

	return table, nil
}

// migrate credentials from the legacy single-entry format to individual entries
func migrate(legacy CredentialsService, cs CredentialsService) error {
	creds, err := legacy.List()
	if err != nil {
		return fmt.Errorf("failed to list legacy credentials: %v", err)
	}

	for _, cred := range creds {
		// Convert Credential to CreateCredentialDetails
		details := CreateCredentialDetails{
			GUID:                cred.GUID, // Preserve the original GUID
			Name:                cred.Name,
			URL:                 cred.URL,
			ServerType:          cred.ServerType,
			ApiKey:              cred.ApiKey,
			SnowflakeConnection: cred.SnowflakeConnection,
			AccountID:           cred.AccountID,
			AccountName:         cred.AccountName,
			RefreshToken:        cred.RefreshToken,
			AccessToken:         cred.AccessToken,
			CloudEnvironment:    cred.CloudEnvironment,
			Token:               cred.Token,
			PrivateKey:          cred.PrivateKey,
		}

		_, err = cs.Set(details)
		if err != nil {
			return fmt.Errorf("failed to migrate credential %q: %v", cred.Name, err)
		}
	}

	legacy.Reset()
	return nil
}
