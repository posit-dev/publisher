// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"fmt"
	"github.com/posit-dev/publisher/internal/server_type"
	"io"
	"os"
	"sync"
	"time"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
)

var fsys = afero.NewOsFs()

const ondiskFilename = ".connect-credentials"

type fileCredential struct {
	GUID       string                 `toml:"guid"`
	Version    uint                   `toml:"version"`
	ServerType server_type.ServerType `toml:"server_type"`
	URL        string                 `toml:"url"`

	// Connect fields
	ApiKey string `toml:"api_key"`

	// Snowflake fields
	SnowflakeConnection string `toml:"snowflake_connection"`

	// Connect Cloud fields
	AccountID    string `toml:"account_id"`
	AccountName  string `toml:"account_name"`
	RefreshToken string `toml:"refresh_token"`
	AccessToken  string `toml:"access_token"`
}

func (cr *fileCredential) IsValid() bool {
	return cr.URL != "" && (cr.ApiKey != "" || cr.SnowflakeConnection != "")
}

func (cr *fileCredential) toCredential(name string) (*Credential, error) {
	serverType, err := server_type.ServerTypeFromURL(cr.URL)
	if err != nil {
		return nil, err
	}
	return &Credential{
		Name:                name,
		ServerType:          serverType,
		GUID:                cr.GUID,
		URL:                 cr.URL,
		ApiKey:              cr.ApiKey,
		SnowflakeConnection: cr.SnowflakeConnection,
		AccountID:           cr.AccountID,
		AccountName:         cr.AccountName,
		RefreshToken:        cr.RefreshToken,
		AccessToken:         cr.AccessToken,
	}, nil
}

type fileCredentials struct {
	Credentials map[string]fileCredential `toml:"credentials"`
}

func newFileCredentials() fileCredentials {
	return fileCredentials{
		Credentials: make(map[string]fileCredential),
	}
}

func (fcs *fileCredentials) CredentialsList() ([]Credential, error) {
	list := []Credential{}
	for credName, fileCred := range fcs.Credentials {
		credential, err := fileCred.toCredential(credName)
		if err != nil {
			return nil, err
		}
		list = append(list, *credential)
	}
	return list, nil
}

func (fcs *fileCredentials) CredentialByGuid(guid string) (*Credential, error) {
	for credName, fileCred := range fcs.Credentials {
		if fileCred.GUID == guid {
			cred, err := fileCred.toCredential(credName)
			if err != nil {
				return nil, err
			}
			return cred, nil
		}
	}
	return nil, NewNotFoundError(guid)
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
		return fservice, err
	}

	return fservice, nil
}

func (c *fileCredentialsService) Set(credDetails CreateCredentialDetails) (*Credential, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	creds, err := c.load()
	if err != nil {
		return nil, err
	}

	cred, err := credDetails.ToCredential()
	if err != nil {
		return nil, err
	}

	err = c.checkForConflicts(creds, *cred)
	if err != nil {
		c.log.Debug("Conflicts storing new credential to file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	creds.Credentials[credDetails.Name] = fileCredential{
		GUID:                cred.GUID,
		Version:             CurrentVersion,
		ServerType:          cred.ServerType,
		URL:                 cred.URL,
		ApiKey:              cred.ApiKey,
		SnowflakeConnection: cred.SnowflakeConnection,
		AccountID:           cred.AccountID,
		AccountName:         cred.AccountName,
		RefreshToken:        cred.RefreshToken,
		AccessToken:         cred.AccessToken,
	}

	err = c.saveFile(creds)
	if err != nil {
		c.log.Debug("Could not update credentials file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	return cred, nil
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

	return credential, nil
}

func (c *fileCredentialsService) List() ([]Credential, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	creds, err := c.load()
	if err != nil {
		c.log.Debug("Error loading credentials from file", "error", err.Error(), "filename", c.credsFilepath.String())
		return nil, err
	}

	return creds.CredentialsList()
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

// Resets the credentials file
// it is a last resort in case the data turns out to be irrecognizable
// Returns the backup path of the original credentials file
func (c *fileCredentialsService) Reset() (string, error) {
	copyFilename, err := c.backupFile()
	if err != nil {
		return "", err
	}
	c.log.Warn("Corrupted credentials data found. The stored data was reset.", "credentials_service", "file")
	c.log.Warn("Previous credentials file backed up.", "credentials_backup", copyFilename)
	newData := newFileCredentials()
	return copyFilename, c.saveFile(newData)
}

func (c *fileCredentialsService) backupFile() (string, error) {
	backupTimestamp := time.Now().Format(time.DateOnly)
	credsCopyPath := c.credsFilepath.Dir().Join(fmt.Sprintf("%s-%s", ondiskFilename, backupTimestamp))

	_, err := credsCopyPath.Stat()
	if os.IsNotExist(err) {
		file, err := credsCopyPath.Create()
		if err != nil {
			return "", NewBackupFileAgentError(credsCopyPath.String(), err)
		}
		file.Close()
	}

	credsCopyFile, err := credsCopyPath.OpenFile(os.O_TRUNC|os.O_RDWR, 0644)
	if err != nil {
		return "", NewBackupFileAgentError(credsCopyPath.String(), err)
	}
	defer credsCopyFile.Close()

	credsFile, err := c.credsFilepath.Open()
	if err != nil {
		return "", NewBackupFileAgentError(credsCopyPath.String(), err)
	}
	defer credsFile.Close()

	_, err = io.Copy(credsCopyFile, credsFile)

	return credsCopyPath.String(), err
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
	creds := newFileCredentials()
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
	credsList, err := creds.CredentialsList()
	if err != nil {
		return err
	}
	for _, cred := range credsList {
		err := cred.ConflictCheck(newCred)
		if err != nil {
			return err
		}
	}
	return nil
}
