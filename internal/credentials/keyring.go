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

	table[cred.GUID] = CredentialRecord{
		GUID:    cred.GUID,
		Version: CurrentVersion,
		Data:    json.RawMessage(raw),
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

// Saves the CredentialTable
func (ks *keyringCredentialsService) save(table CredentialTable) error {
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

// Loads the CredentialTable from keyring
func (ks *keyringCredentialsService) load() (CredentialTable, error) {
	data, err := keyring.Get(ServiceName, "credentials")
	if err != nil {
		if err == keyring.ErrNotFound {
			return make(map[string]CredentialRecord), nil
		}
		return nil, NewLoadError(err)
	}

	var table CredentialTable
	err = json.Unmarshal([]byte(data), &table)
	if err != nil {
		return nil, fmt.Errorf("failed to deserialize credentials: %v", err)
	}

	return table, nil
}
