// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/zalando/go-keyring"
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

// Delete removes a Credential by its guid.
// If lookup by guid fails, a NotFoundError is returned.
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

// Get retrieves a Credential by its guid.
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

// List retrieves all Credentials
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

// Set creates a Credential.
// A guid is assigned to the Credential using the UUIDv4 specification.
func (ks *keyringCredentialsService) Set(name string, url string, ak string) (*Credential, error) {
	table, err := ks.load()
	if err != nil {
		return nil, err
	}

	normalizedUrl, err := util.NormalizeServerURL(url)
	if err != nil {
		return nil, err
	}

	guid := uuid.New().String()
	cred := Credential{
		GUID:   guid,
		Name:   name,
		URL:    normalizedUrl,
		ApiKey: ak,
	}

	err = ks.checkForConflicts(&table, &cred)
	if err != nil {
		return nil, err
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

	err = ks.save(table)
	if err != nil {
		return nil, err
	}

	return &cred, nil
}

// Resets the CredentialTable from keyring
// it is a last resort in case the keyring data turns out to be irrecognizable
func (ks *keyringCredentialsService) Reset() error {
	newTable := make(map[string]CredentialRecord)
	return ks.save(newTable)
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
