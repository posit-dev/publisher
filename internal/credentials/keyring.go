// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"encoding/json"
	"fmt"

	"github.com/zalando/go-keyring"

	"github.com/posit-dev/publisher/internal/logging"
)

type keyringCredentialsService struct {
	log logging.Logger
}

const (
	CredentialKeyPrefix = "credential_"
	LegacyKey           = "credentials"
)

func NewKeyringCredentialsService(log logging.Logger) *keyringCredentialsService {
	return &keyringCredentialsService{
		log: log,
	}
}

func (ks *keyringCredentialsService) IsSupported() bool {
	_, err := ks.load()
	if err != nil {
		ks.log.Debug("System keyring service is not available", "error", err.Error())
		return false
	}
	return true
}

func (ks *keyringCredentialsService) Delete(guid string) error {
	table, err := ks.load()
	if err != nil {
		return err
	}

	_, exists := table[guid]
	if !exists {
		ks.log.Debug("Credential does not exist", "credential", guid)
		return NewNotFoundError(guid)
	}

	delete(table, guid)

	// Delete the credential from the keyring individually
	key := CredentialKeyPrefix + guid
	err = keyring.Delete(ServiceName, key)
	if err != nil && err != keyring.ErrNotFound {
		ks.log.Debug("Failed to delete credential from keyring", "credential", guid, "error", err.Error())
	}

	// Update the GUID list to remove this GUID
	err = ks.removeGuidFromList(guid)
	if err != nil {
		ks.log.Debug("Failed to remove GUID from guid list", "error", err.Error())
	}

	return ks.save(table)
}

func (ks *keyringCredentialsService) Get(guid string) (*Credential, error) {
	table, err := ks.load()
	if err != nil {
		return nil, err
	}

	cr, exists := table[guid]
	if !exists {
		ks.log.Debug("Credential does not exist", "credential", guid)
		return nil, NewNotFoundError(guid)
	}

	return cr.ToCredential()
}

func (ks *keyringCredentialsService) List() ([]Credential, error) {
	records, err := ks.load()
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

func (ks *keyringCredentialsService) Set(credDetails CreateCredentialDetails) (*Credential, error) {
	return ks.set(credDetails, true)
}

func (ks *keyringCredentialsService) ForceSet(credDetails CreateCredentialDetails) (*Credential, error) {
	return ks.set(credDetails, false)
}

func (ks *keyringCredentialsService) set(credDetails CreateCredentialDetails, checkConflict bool) (*Credential, error) {
	table, err := ks.load()
	if err != nil {
		return nil, err
	}

	cred, err := credDetails.ToCredential()
	if err != nil {
		return nil, err
	}

	if checkConflict {
		err = ks.checkForConflicts(&table, cred)
		if err != nil {
			return nil, err
		}
	}

	raw, err := json.Marshal(cred)
	if err != nil {
		return nil, fmt.Errorf("error marshalling credential: %v", err)
	}

	record := CredentialRecord{
		GUID:    cred.GUID,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw),
	}

	table[cred.GUID] = record

	// Update the guid list of GUIDs
	err = ks.updateGuidsListFor(cred.GUID)
	if err != nil {
		ks.log.Debug("Failed to update guid list GUIDs", "error", err.Error())
	}

	err = ks.save(table)
	if err != nil {
		return nil, err
	}

	return cred, nil
}

// There is no backup for keyring data due to encryption, always returns empty string
func (ks *keyringCredentialsService) Reset() (string, error) {
	ks.log.Warn("Corrupted credentials data found. The stored data was reset.", "credentials_service", "keyring")

	// First try to delete the legacy key
	err := keyring.Delete(ServiceName, LegacyKey)
	if err != nil && err != keyring.ErrNotFound {
		ks.log.Debug("Failed to delete legacy credentials entry", "error", err.Error())
	}

	// Then try to delete all individual credential entries
	knownGuids, err := ks.getKnownCredentialGuids()
	if err == nil {
		for _, guid := range knownGuids {
			key := CredentialKeyPrefix + guid
			err := keyring.Delete(ServiceName, key)
			if err != nil && err != keyring.ErrNotFound {
				ks.log.Debug("Failed to delete credential", "credential", guid, "error", err.Error())
			}
		}
	}

	// Finally, delete the GUIDs list
	err = keyring.Delete(ServiceName, "credential_guids")
	if err != nil && err != keyring.ErrNotFound {
		ks.log.Debug("Failed to delete credential GUIDs list", "error", err.Error())
	}

	// Initialize with empty table
	newTable := make(map[string]CredentialRecord)
	return "", ks.save(newTable)
}

func (ks *keyringCredentialsService) checkForConflicts(
	table *map[string]CredentialRecord,
	c *Credential) error {
	// Check if Credential attributes (URL or name) are already used by another credential
	for guid, record := range *table {
		cred, err := record.ToCredential()
		if err != nil {
			return NewCorruptedError(guid)
		}

		err = cred.ConflictCheck(*c)
		if err != nil {
			return err
		}
	}
	return nil
}

// Saves the CredentialTable by storing each credential separately
func (ks *keyringCredentialsService) save(table CredentialTable) error {
	// First try to load the legacy format to check if we need to migrate
	_, err := keyring.Get(ServiceName, LegacyKey)
	if err == nil {
		// Legacy format exists, we should migrate and then delete it
		ks.log.Debug("Found credentials in legacy format, migrating to individual entries")
		migrateErr := ks.migrateFromLegacyFormat(table)
		if migrateErr != nil {
			return fmt.Errorf("failed to migrate from legacy format: %v", migrateErr)
		}
		// Delete the legacy key after successful migration
		delErr := keyring.Delete(ServiceName, LegacyKey)
		if delErr != nil && delErr != keyring.ErrNotFound {
			ks.log.Debug("Failed to delete legacy credentials entry", "error", delErr.Error())
		}
		return nil
	} else if err != keyring.ErrNotFound {
		// An error occurred that wasn't just the legacy key not being found
		return fmt.Errorf("failed to check legacy credentials: %v", err)
	}

	// Get existing credentials to determine what needs to be updated/added/removed
	existingCreds, loadErr := ks.loadIndividualCredentials()
	if loadErr != nil {
		return fmt.Errorf("failed to load existing credentials: %v", loadErr)
	}

	// Track existing GUIDs to detect deletions
	existingGUIDs := make(map[string]bool)
	for guid := range existingCreds {
		existingGUIDs[guid] = true
	}

	// Add or update each credential in the table
	for guid, record := range table {
		data, err := json.Marshal(record)
		if err != nil {
			return fmt.Errorf("failed to serialize credential %s: %v", guid, err)
		}

		key := CredentialKeyPrefix + guid
		err = keyring.Set(ServiceName, key, string(data))
		if err != nil {
			return fmt.Errorf("failed to set credential %s: %v", guid, err)
		}

		// Mark this GUID as processed
		delete(existingGUIDs, guid)
	}

	// Delete any credentials that are no longer in the table
	for guid := range existingGUIDs {
		key := CredentialKeyPrefix + guid
		err := keyring.Delete(ServiceName, key)
		if err != nil && err != keyring.ErrNotFound {
			ks.log.Debug("Failed to delete credential", "credential", guid, "error", err.Error())
		}
	}

	return nil
}

// migrate credentials from the legacy single-entry format to individual entries
func (ks *keyringCredentialsService) migrateFromLegacyFormat(table CredentialTable) error {
	for guid, record := range table {
		data, err := json.Marshal(record)
		if err != nil {
			return fmt.Errorf("failed to serialize credential %s: %v", guid, err)
		}

		key := CredentialKeyPrefix + guid
		err = keyring.Set(ServiceName, key, string(data))
		if err != nil {
			return fmt.Errorf("failed to set credential %s during migration: %v", guid, err)
		}
	}

	return nil
}

// Loads the CredentialTable from keyring, supporting both legacy and new formats
func (ks *keyringCredentialsService) load() (CredentialTable, error) {
	// First try to load from individual credential entries
	table, err := ks.loadIndividualCredentials()
	if err != nil {
		return nil, err
	}

	// If we have individual credentials, return them
	if len(table) > 0 {
		return table, nil
	}

	// If no individual credentials found, try the legacy format
	legacyData, err := keyring.Get(ServiceName, LegacyKey)
	if err != nil {
		if err == keyring.ErrNotFound {
			// Neither format found, return empty table
			return make(map[string]CredentialRecord), nil
		}
		return nil, NewLoadError(err)
	}

	// Found legacy data, parse it and then migrate
	var legacyTable CredentialTable
	err = json.Unmarshal([]byte(legacyData), &legacyTable)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	go func() {
		migrateErr := ks.migrateFromLegacyFormat(legacyTable)
		if migrateErr == nil {
			// Only delete the legacy key if migration was successful
			delErr := keyring.Delete(ServiceName, LegacyKey)
			if delErr != nil && delErr != keyring.ErrNotFound {
				ks.log.Debug("Failed to delete legacy credentials entry", "error", delErr.Error())
			}
		} else {
			ks.log.Debug("Failed to migrate from legacy format", "error", migrateErr.Error())
		}
	}()

	return legacyTable, nil
}

func (ks *keyringCredentialsService) loadIndividualCredentials() (CredentialTable, error) {
	table := make(map[string]CredentialRecord)

	// First get all stored credential GUIDs that might be available
	knownGuids, err := ks.getKnownCredentialGuids()
	if err != nil {
		return nil, fmt.Errorf("failed to get known credential GUIDs: %v", err)
	}

	// Load each individual credential
	for _, guid := range knownGuids {
		key := CredentialKeyPrefix + guid
		data, err := keyring.Get(ServiceName, key)

		if err != nil {
			if err == keyring.ErrNotFound {
				// Skip non-existent credentials
				continue
			}
			return nil, fmt.Errorf("failed to load credential %s: %v", guid, err)
		}

		var record CredentialRecord
		err = json.Unmarshal([]byte(data), &record)
		if err != nil {
			return nil, fmt.Errorf("failed to deserialize credential %s: %v", guid, err)
		}

		table[guid] = record
	}

	return table, nil
}

// We store known credentials in a single, known GUIDs list keyring item so that we can
// enumerate and retrieve them. This is necessary because go-keyring does not provide
// a way to list all keys stored under a service (at least at time of writting).
func (ks *keyringCredentialsService) getKnownCredentialGuids() ([]string, error) {
	// Try to get the GUIDs list first
	guidsListData, err := keyring.Get(ServiceName, "credential_guids")
	if err == nil {
		// Parse the GUIDs list
		var guids []string
		err = json.Unmarshal([]byte(guidsListData), &guids)
		if err == nil {
			return guids, nil
		}
		// If we can't parse the cached GUIDs, log and continue
		ks.log.Debug("Failed to parse credential GUIDs list", "error", err.Error())
	}

	// If we don't have a GUIDs list or failed to parse it, return empty list
	// The caller will handle legacy format or initialization of empty credentials
	return []string{}, nil
}

func (ks *keyringCredentialsService) updateGuidsListFor(guid string) error {
	guids, err := ks.getKnownCredentialGuids()
	if err != nil {
		return fmt.Errorf("failed to get known credential GUIDs: %v", err)
	}

	// Check if the GUID is already in the list
	for _, existingGuid := range guids {
		if existingGuid == guid {
			// GUID already in GUIDs list, no need to update
			return nil
		}
	}

	// Add the GUID to the list
	guids = append(guids, guid)

	// Save the updated list
	return ks.saveGuidList(guids)
}

func (ks *keyringCredentialsService) removeGuidFromList(guid string) error {
	guids, err := ks.getKnownCredentialGuids()
	if err != nil {
		return fmt.Errorf("failed to get known credential GUIDs: %v", err)
	}

	// Create a new list without the given GUID
	var updatedGuids []string
	for _, existingGuid := range guids {
		if existingGuid != guid {
			updatedGuids = append(updatedGuids, existingGuid)
		}
	}

	// Save the updated list
	return ks.saveGuidList(updatedGuids)
}

func (ks *keyringCredentialsService) saveGuidList(guids []string) error {
	// Serialize the GUIDs list
	data, err := json.Marshal(guids)
	if err != nil {
		return fmt.Errorf("failed to serialize GUIDs list: %v", err)
	}

	// Save to keyring
	err = keyring.Set(ServiceName, "credential_guids", string(data))
	if err != nil {
		return fmt.Errorf("failed to save GUIDs list: %v", err)
	}

	return nil
}
