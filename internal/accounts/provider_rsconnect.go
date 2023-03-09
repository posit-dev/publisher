package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/util"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type rsconnectProvider struct {
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func newRSConnectProvider(logger rslog.Logger) provider {
	return &rsconnectProvider{
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.AccountsRegion),
	}
}

// configDir returns the directory where the rsconnect
// R package stores its configuration.
func (p *rsconnectProvider) configDir() (string, error) {
	// https://github.com/rstudio/rsconnect/blob/main/R/config.R
	baseDir := os.Getenv("R_USER_CONFIG_DIR")
	if baseDir != "" {
		p.debugLogger.Debugf("rsconnect: using R_USER_CONFIG_DIR (%s)", baseDir)
	} else {
		baseDir = os.Getenv("XDG_CONFIG_HOME")
		if baseDir != "" {
			p.debugLogger.Debugf("rsconnect: using XDG_CONFIG_HOME (%s)", baseDir)
		}
	}
	if baseDir == "" {
		switch runtime.GOOS {
		case "windows":
			baseDir = filepath.Join(os.Getenv("APPDATA"), "R", "config")
		case "darwin":
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			baseDir = filepath.Join(home, "Library", "Preferences", "org.R-project.R")
		default:
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			baseDir = filepath.Join(home, ".config")
		}
	}
	return filepath.Join(baseDir, "R", "rsconnect"), nil
}

func (p *rsconnectProvider) oldConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	configDir := os.Getenv("R_USER_CONFIG_DIR")
	if configDir != "" {
		p.debugLogger.Debugf("rsconnect: using R_USER_CONFIG_DIR (%s)", configDir)
		configDir = filepath.Join(configDir, "rsconnect")
	} else {
		switch runtime.GOOS {
		case "windows":
			configDir = os.Getenv("APPDATA")
		case "darwin":
			configDir = filepath.Join(homeDir, "Library", "Application Support")
		default:
			configDir = os.Getenv("XDG_CONFIG_HOME")
			if configDir != "" {
				p.debugLogger.Debugf("rsconnect: using XDG_CONFIG_HOME (%s)", configDir)
			} else {
				configDir = filepath.Join(homeDir, ".config")
			}
		}
		configDir = filepath.Join(configDir, "R", "rsconnect")
	}
	p.debugLogger.Debugf("rsconnect: candidate old config directory is '%s'", configDir)
	configDir, err = filepath.Abs(configDir)
	if err != nil {
		return "", err
	}
	configDir, err = filepath.EvalSymlinks(configDir)
	if err != nil {
		return "", err
	}
	return configDir, nil
}

// makeServerNameMap constructs a server name-to-url map
// from the provided rsconnect server list.
func makeServerNameMap(rscServers util.DCFData) map[string]string {
	serverNameToURL := map[string]string{}
	for _, server := range rscServers {
		name := server["name"]
		url := strings.TrimSuffix(server["url"], "/__api__")
		serverNameToURL[name] = url
	}
	// rsconnect does not make server entries for public instances
	serverNameToURL["shinyapps.io"] = "shinyapps.io"
	serverNameToURL["posit.cloud"] = "posit.cloud"
	serverNameToURL["rstudio.cloud"] = "posit.cloud"
	return serverNameToURL
}

// accountsFromConfig constructs Account objects from the
// provided rsconnect server and account lists. Primarily,
// this is a join between the two on account.server = server.name.
func (p *rsconnectProvider) accountsFromConfig(rscServers, rscAccounts util.DCFData) ([]Account, error) {
	accounts := []Account{}
	serverNameToURL := makeServerNameMap(rscServers)
	for _, account := range rscAccounts {
		serverName := account["server"]
		if serverName == "" {
			return accounts, fmt.Errorf("Missing server name in account %v", account)
		}
		url, ok := serverNameToURL[serverName]
		if !ok {
			return accounts, fmt.Errorf("Account references nonexistent server name '%s'", serverName)
		}
		account := Account{
			Source:      AccountSourceRsconnect,
			Type:        accountTypeFromURL(url),
			Name:        serverName,
			URL:         url,
			AccountName: account["username"],
			Token:       account["token"],
			Secret:      account["secret"],
			PrivateKey:  account["private_key"],
		}
		account.AuthType = account.InferAuthType()
		accounts = append(accounts, account)
	}
	return accounts, nil
}

func (p *rsconnectProvider) Load() ([]Account, error) {
	configDir, err := p.configDir()
	if err != nil {
		return nil, fmt.Errorf("Error getting rsconnect config directory: %s", err)
	}
	if util.Exists(configDir) {
		return p.loadFromConfigDir(configDir)
	}
	p.debugLogger.Debugf("rsconnect config directory '%s' does not exist, checking old config directory", configDir)
	oldConfigDir, err := p.oldConfigDir()
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			p.debugLogger.Debugf("Old rsconnect config directory does not exist")
			return nil, nil
		} else {
			return nil, fmt.Errorf("Error getting old rsconnect config directory: %s", err)
		}
	}
	return p.loadFromConfigDir(oldConfigDir)
}

// Load loads the list of accounts stored by
// rsconnect, by reading its servers and account DCF files.
func (p *rsconnectProvider) loadFromConfigDir(configDir string) ([]Account, error) {
	p.logger.Infof("Loading rsconnect accounts from %s", configDir)
	serverPattern := filepath.Join(configDir, "servers", "*.dcf")
	rscServers, err := util.ReadDCFFiles(serverPattern)
	if err != nil {
		return nil, err
	}
	accountsPattern := filepath.Join(configDir, "accounts", "*", "*.dcf")
	rscAccounts, err := util.ReadDCFFiles(accountsPattern)
	if err != nil {
		return nil, err
	}
	accounts, err := p.accountsFromConfig(rscServers, rscAccounts)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
