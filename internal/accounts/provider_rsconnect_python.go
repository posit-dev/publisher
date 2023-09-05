package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/spf13/afero"
)

type rsconnectPythonProvider struct {
	fs  afero.Fs
	log logging.Logger
}

func newRSConnectPythonProvider(fs afero.Fs, log logging.Logger) *rsconnectPythonProvider {
	return &rsconnectPythonProvider{
		fs:  fs,
		log: log,
	}
}

// Returns the path to rsconnect-python's configuration directory.
// The config directory is where the server list (servers.json) is
// stored, along with deployment metadata for any deployments that
// were made from read-only directories.
func (p *rsconnectPythonProvider) configDir(goos string) (string, error) {
	// https://github.com/rstudio/rsconnect-python/blob/master/rsconnect/metadata.py
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	var baseDir string

	switch goos {
	case "linux":
		baseDir = os.Getenv("XDG_CONFIG_HOME")
		if baseDir != "" {
			p.log.Debug("rsconnect-python: using XDG_CONFIG_HOME", "dir", baseDir)
		}
	case "windows":
		baseDir = os.Getenv("APPDATA")
	case "darwin":
		baseDir = filepath.Join(home, "Library", "Application Support")
	}
	if baseDir == "" {
		return filepath.Join(home, ".rsconnect-python"), nil
	} else {
		return filepath.Join(baseDir, "rsconnect-python"), nil
	}
}

// Returns the path to rsconnect-python's servers.json file.
func (p *rsconnectPythonProvider) serverListPath(goos string) (string, error) {
	dir, err := p.configDir(goos)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "servers.json"), nil
}

type rsconnectPythonAccount struct {
	Name        string `json:"name"`         // Nickname
	URL         string `json:"url"`          // Server URL, e.g. https://connect.example.com/rsc
	Insecure    bool   `json:"insecure"`     // Skip https server verification
	Certificate string `json:"ca_cert"`      // Root CA certificate, if server cert is signed by a private CA
	ApiKey      string `json:"api_key"`      // For Connect servers
	AccountName string `json:"account_name"` // For shinyapps.io and Posit Cloud servers
	Token       string `json:"token"`        //   ...
	Secret      string `json:"secret"`       //   ...
}

func (r *rsconnectPythonAccount) toAccount() Account {
	account := Account{
		Name:        r.Name,
		URL:         r.URL,
		Insecure:    r.Insecure,
		Certificate: r.Certificate,
		ApiKey:      r.ApiKey,
		AccountName: r.AccountName,
		Token:       r.Token,
		Secret:      r.Secret,
	}
	account.Source = AccountSourceRsconnectPython

	// rsconnect-python does not store the server
	// type, so infer it from the URL.
	account.ServerType = serverTypeFromURL(account.URL)
	account.AuthType = account.InferAuthType()

	// Migrate existing rstudio.cloud entries.
	if account.URL == "https://api.rstudio.cloud" {
		account.URL = "https://api.posit.cloud"
	}
	return account
}

func (p *rsconnectPythonProvider) decodeServerStore(data []byte) ([]Account, error) {
	// rsconnect-python stores a map of nicknames to servers
	var accountMap map[string]rsconnectPythonAccount
	err := json.Unmarshal(data, &accountMap)
	if err != nil {
		return nil, err
	}

	accounts := []Account{}
	for _, rscpAccount := range accountMap {
		accounts = append(accounts, rscpAccount.toAccount())
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return accounts, nil
}

// Load loads the list of accounts stored by rsconnect-python
// by reading its servers.json file.
func (p *rsconnectPythonProvider) Load() ([]Account, error) {
	path, err := p.serverListPath(runtime.GOOS)
	if err != nil {
		return nil, err
	}
	data, err := afero.ReadFile(p.fs, path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			p.log.Debug("rsconnect-python config file does not exist, checking old config directory", "path", path)
			return nil, nil
		}
		return nil, err
	}
	p.log.Info("Loading rsconnect-python accounts", "path", path)
	accounts, err := p.decodeServerStore(data)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
