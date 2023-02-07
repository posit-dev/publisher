package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

type rsconnectPythonProvider struct{}

func newRSConnectPythonProvider() provider {
	return &rsconnectPythonProvider{}
}

// Returns the path to rsconnect-python's configuration directory.
// The config directory is where the server list (servers.json) is
// stored, along with deployment metadata for any deployments that
// were made from read-only directories.
func (p *rsconnectPythonProvider) configDir() (string, error) {
	// https://github.com/rstudio/rsconnect-python/blob/master/rsconnect/metadata.py
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	var baseDir string

	switch runtime.GOOS {
	case "linux":
		baseDir = os.Getenv("XDG_CONFIG_HOME")
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
func (p *rsconnectPythonProvider) serverListPath() (string, error) {
	dir, err := p.configDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "servers.json"), nil
}

func (p *rsconnectPythonProvider) decodeServerStore(data []byte) ([]Account, error) {
	// rsconnect-python stores a map of nicknames to servers
	var serverMap map[string]Account
	err := json.Unmarshal(data, &serverMap)
	if err != nil {
		return nil, err
	}

	accounts := []Account{}
	for _, account := range serverMap {
		account.Source = AccountSourceRSCP

		// rsconnect-python does not store the server
		// type, so infer it from the URL.
		account.Type = accountTypeFromURL(account.URL)

		if account.ApiKey != "" {
			account.AuthType = AccountAuthAPIKey
		} else if account.Token != "" && account.Secret != "" {
			account.AuthType = AccountAuthToken
		} else {
			account.AuthType = AccountAuthNone
		}

		// Migrate existing rstudio.cloud entries.
		if account.URL == "https://api.rstudio.cloud" {
			account.URL = "https://api.posit.cloud"
		}
		accounts = append(accounts, account)
	}
	return accounts, nil
}

// Load loads the list of accounts stored by rsconnect-python
// by reading its servers.json file.
func (p *rsconnectPythonProvider) Load() ([]Account, error) {
	path, err := p.serverListPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	accounts, err := p.decodeServerStore(data)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
