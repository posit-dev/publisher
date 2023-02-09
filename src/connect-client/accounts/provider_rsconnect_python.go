package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/debug"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type rsconnectPythonProvider struct {
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func newRSConnectPythonProvider(logger rslog.Logger) provider {
	return &rsconnectPythonProvider{
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.AccountsRegion),
	}
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
		if baseDir != "" {
			p.debugLogger.Debugf("rsconnect-python: using XDG_CONFIG_HOME (%s)", baseDir)
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
func (p *rsconnectPythonProvider) serverListPath() (string, error) {
	dir, err := p.configDir()
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
	account.Type = accountTypeFromURL(account.URL)
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
			p.debugLogger.Debugf("rsconnect-python config file does not exist (%s), checking old config directory", path)
			return nil, nil
		}
		return nil, err
	}
	p.logger.Infof("Loading rsconnect-python accounts from %s", path)
	accounts, err := p.decodeServerStore(data)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
