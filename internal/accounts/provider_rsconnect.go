package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/util/dcf"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type rsconnectProvider struct {
	fs          afero.Fs
	goos        string
	dcfReader   dcf.FileReader
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func newRSConnectProvider(fs afero.Fs, logger rslog.Logger) *rsconnectProvider {
	return &rsconnectProvider{
		fs:          fs,
		goos:        runtime.GOOS,
		dcfReader:   dcf.NewFileReader(fs),
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
		switch p.goos {
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
		switch p.goos {
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
	return configDir, nil
}

// makeServerNameMap constructs a server name-to-url map
// from the provided rsconnect server list.
func makeServerNameMap(rscServers dcf.Records) map[string]string {
	serverNameToURL := map[string]string{}
	for _, server := range rscServers {
		name := server["name"]
		url := strings.TrimSuffix(server["url"], "/__api__")
		serverNameToURL[name] = url
	}
	// rsconnect does not make server entries for public instances
	serverNameToURL["shinyapps.io"] = "https://api.shinyapps.io"
	serverNameToURL["posit.cloud"] = "https://api.posit.cloud"
	serverNameToURL["rstudio.cloud"] = "https://api.posit.cloud"
	return serverNameToURL
}

// accountsFromConfig constructs Account objects from the
// provided rsconnect server and account lists. Primarily,
// this is a join between the two on account.server = server.name.
func (p *rsconnectProvider) accountsFromConfig(rscServers, rscAccounts dcf.Records) ([]Account, error) {
	accounts := []Account{}
	serverNameToURL := makeServerNameMap(rscServers)
	for _, account := range rscAccounts {
		serverName := account["server"]
		if serverName == "" {
			return accounts, fmt.Errorf("Missing server name in rsconnect account")
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
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return accounts, nil
}

func (p *rsconnectProvider) Load() ([]Account, error) {
	configDir, err := p.configDir()
	if err != nil {
		return nil, fmt.Errorf("Error getting rsconnect config directory: %w", err)
	}
	exists, err := afero.Exists(p.fs, configDir)
	if err == nil && exists {
		return p.loadFromConfigDir(configDir)
	}
	p.debugLogger.Debugf("rsconnect config directory '%s' does not exist, checking old config directory", configDir)
	oldConfigDir, err := p.oldConfigDir()
	if err != nil {
		return nil, err
	}
	exists, err = afero.Exists(p.fs, oldConfigDir)
	if err != nil {
		return nil, err
	}
	if !exists {
		p.debugLogger.Debugf("Old rsconnect config directory does not exist")
		return nil, nil
	}

	// TODO: afero doesn't support EvalSymlinks; make our own using fs.Lstat?
	// oldConfigDir, err = filepath.EvalSymlinks(oldConfigDir)
	// if err != nil {
	// 	if errors.Is(err, fs.ErrNotExist) {
	// 		p.debugLogger.Debugf("Old rsconnect config directory does not exist")
	// 		return nil, nil
	// 	} else {
	// 		return nil, fmt.Errorf("Error getting old rsconnect config directory: %s", err)
	// 	}
	// }
	return p.loadFromConfigDir(oldConfigDir)
}

// Load loads the list of accounts stored by
// rsconnect, by reading its servers and account DCF files.
func (p *rsconnectProvider) loadFromConfigDir(configDir string) ([]Account, error) {
	p.logger.Infof("Loading rsconnect accounts from %s", configDir)
	serverPattern := filepath.Join(configDir, "servers", "*.dcf")
	rscServers, err := p.dcfReader.ReadFiles(serverPattern)
	if err != nil {
		return nil, err
	}
	accountsPattern := filepath.Join(configDir, "accounts", "*", "*.dcf")
	rscAccounts, err := p.dcfReader.ReadFiles(accountsPattern)
	if err != nil {
		return nil, err
	}
	accounts, err := p.accountsFromConfig(rscServers, rscAccounts)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
