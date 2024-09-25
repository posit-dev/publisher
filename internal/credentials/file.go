// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"fmt"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
)

var fsys = afero.NewOsFs()

const ondiskFilename = ".connect-credentials"

type fileCredential struct {
	GUID    string `toml:"guid"`
	Version uint   `toml:"version"`
	URL     string `toml:"url"`
	ApiKey  string `toml:"api_key"`
}

func (cr *fileCredential) IsValid() bool {
	return cr.URL != "" && cr.ApiKey != ""
}

type fileCredentials struct {
	Credentials map[string]fileCredential `toml:"credentials"`
}

func (fcs *fileCredentials) CredentialsList() []Credential {
	var list []Credential
	for credName, fileCred := range fcs.Credentials {
		list = append(list, Credential{
			Name:   credName,
			GUID:   fileCred.GUID,
			URL:    fileCred.URL,
			ApiKey: fileCred.ApiKey,
		})
	}
	return list
}

func (fcs *fileCredentials) CredentialByGuid(guid string) (Credential, error) {
	var cred Credential
	for credName, fileCred := range fcs.Credentials {
		if fileCred.GUID == guid {
			cred = Credential{
				Name:   credName,
				GUID:   fileCred.GUID,
				URL:    fileCred.URL,
				ApiKey: fileCred.ApiKey,
			}
			return cred, nil
		}
	}
	return Credential{}, NewNotFoundError(guid)
}

func (fcs *fileCredentials) RemoveByName(name string) {
	delete(fcs.Credentials, name)
}

type fileCredentialsService struct {
	mu            sync.Mutex
	log           logging.Logger
	credsFilepath util.AbsolutePath
}

func NewFileCredentialsService(log logging.Logger) (*fileCredentialsService, error) {
	fservice := &fileCredentialsService{
		log: log,
	}

	// Set home dir credentials file path
	homeDir, err := util.UserHomeDir(fsys)
	if err != nil {
		return nil, err
	}
	fservice.credsFilepath = homeDir.Join(ondiskFilename)

	// Verify file can be modified, will create if not exists
	err = fservice.setup()
	if err != nil {
		return nil, err
	}

	return fservice, nil
}

func (c *fileCredentialsService) Set(name, url, ak string) (*Credential, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if name == "" || url == "" || ak == "" {
		return nil, NewIncompleteCredentialError()
	}

	creds, err := c.load()
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

	err = c.checkForConflicts(creds, cred)
	if err != nil {
		c.log.Debug("Conflicts storing new credential to file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	creds.Credentials[name] = fileCredential{
		GUID:    guid,
		Version: CurrentVersion,
		URL:     normalizedUrl,
		ApiKey:  ak,
	}

	err = c.saveFile(creds)
	if err != nil {
		c.log.Debug("Could not update credentials file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	return &cred, nil
}

func (c *fileCredentialsService) Get(guid string) (*Credential, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	creds, err := c.load()
	if err != nil {
		c.log.Debug("Error loading credentials from file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	credential, err := creds.CredentialByGuid(guid)
	if err != nil {
		c.log.Debug("Could not find credential in file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	return &credential, nil
}

func (c *fileCredentialsService) List() ([]Credential, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	creds, err := c.load()
	if err != nil {
		c.log.Debug("Error loading credentials from file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	return creds.CredentialsList(), nil
}

func (c *fileCredentialsService) Delete(guid string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// First verify that credential exists
	creds, err := c.load()
	if err != nil {
		c.log.Debug("Cannot delete credential, error loading credentials from file", "error", err.Error(), "filename", c.credsFilepath.String())
		return err
	}

	credential, err := creds.CredentialByGuid(guid)
	if err != nil {
		c.log.Debug("Cannot delete credential that does not exist", "error", err.Error(), "filename", c.credsFilepath.String())
		return err
	}

	creds.RemoveByName(credential.Name)

	err = c.saveFile(creds)
	if err != nil {
		c.log.Debug("Could not update credentials file", "error", err.Error(), "filename", c.credsFilepath.String())
		return err
	}

	return nil
}

func (c *fileCredentialsService) setup() error {
	_, err := c.credsFilepath.Stat()
	if os.IsNotExist(err) {
		file, err := c.credsFilepath.Create()
		if err != nil {
			return err
		}
		file.Close()
		return nil
	}

	_, err = c.load()
	if err != nil {
		return NewLoadError(err)
	}

	return nil
}

func (c *fileCredentialsService) load() (fileCredentials, error) {
	var creds fileCredentials
	err := util.ReadTOMLFile(c.credsFilepath, &creds)
	if err != nil {
		return creds, NewLoadError(err)
	}
	c.normalizeAll(&creds)
	return creds, nil
}

func (c *fileCredentialsService) saveFile(credsData fileCredentials) error {
	credsFile, err := c.credsFilepath.OpenFile(os.O_TRUNC|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer credsFile.Close()
	enc := toml.NewEncoder(credsFile)
	return enc.Encode(credsData)
}

func (c *fileCredentialsService) normalizeCred(cred *fileCredential) error {
	if cred.IsValid() {
		normalizedUrl, err := util.NormalizeServerURL(cred.URL)
		if err != nil {
			return fmt.Errorf("Error normalizing file based credential URL: %s %v", cred.URL, err)
		}
		cred.URL = normalizedUrl
	}
	return nil
}

func (c *fileCredentialsService) normalizeAll(creds *fileCredentials) error {
	for name, cred := range creds.Credentials {
		err := c.normalizeCred(&cred)
		if err != nil {
			return err
		}
		creds.Credentials[name] = cred
	}
	return nil
}

func (c *fileCredentialsService) checkForConflicts(creds fileCredentials, newCred Credential) error {
	// Check if URL or name are already used by another credential
	for _, cred := range creds.CredentialsList() {
		err := cred.ConflictCheck(newCred)
		if err != nil {
			return err
		}
	}
	return nil
}
