package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"runtime"
	"sort"
	"strings"

	"github.com/rstudio/connect-client/internal/debug"
	"github.com/rstudio/connect-client/internal/util"
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
		dcfReader:   dcf.NewFileReader(),
		logger:      logger,
		debugLogger: rslog.NewDebugLogger(debug.AccountsRegion),
	}
}

// configDir returns the directory where the rsconnect
// R package stores its configuration.
func (p *rsconnectProvider) configDir() (util.Path, error) {
	// https://github.com/rstudio/rsconnect/blob/main/R/config.R
	baseDir := util.PathFromEnvironment("R_USER_CONFIG_DIR", p.fs)
	if baseDir.Path() != "" {
		p.debugLogger.Debugf("rsconnect: using R_USER_CONFIG_DIR (%s)", baseDir)
	} else {
		baseDir = util.PathFromEnvironment("XDG_CONFIG_HOME", p.fs)
		if baseDir.Path() != "" {
			p.debugLogger.Debugf("rsconnect: using XDG_CONFIG_HOME (%s)", baseDir)
		}
	}
	if baseDir.Path() == "" {
		switch p.goos {
		case "windows":
			baseDir = util.PathFromEnvironment("APPDATA", p.fs).Join("R", "config")
		case "darwin":
			home, err := util.UserHomeDir(p.fs)
			if err != nil {
				return util.Path{}, err
			}
			baseDir = home.Join("Library", "Preferences", "org.R-project.R")
		default:
			home, err := util.UserHomeDir(p.fs)
			if err != nil {
				return util.Path{}, err
			}
			baseDir = home.Join(".config")
		}
	}
	return baseDir.Join("R", "rsconnect"), nil
}

func (p *rsconnectProvider) oldConfigDir() (util.Path, error) {
	home, err := util.UserHomeDir(p.fs)
	if err != nil {
		return util.Path{}, err
	}
	configDir := util.PathFromEnvironment("R_USER_CONFIG_DIR", p.fs)
	if configDir.Path() != "" {
		p.debugLogger.Debugf("rsconnect: using R_USER_CONFIG_DIR (%s)", configDir)
		configDir = configDir.Join("rsconnect")
	} else {
		switch p.goos {
		case "windows":
			configDir = util.PathFromEnvironment("APPDATA", p.fs)
		case "darwin":
			configDir = home.Join("Library", "Application Support")
		default:
			configDir = util.PathFromEnvironment("XDG_CONFIG_HOME", p.fs)
			if configDir.Path() != "" {
				p.debugLogger.Debugf("rsconnect: using XDG_CONFIG_HOME (%s)", configDir)
			} else {
				configDir = home.Join(".config")
			}
		}
		configDir = configDir.Join("R", "rsconnect")
	}
	p.debugLogger.Debugf("rsconnect: candidate old config directory is '%s'", configDir)
	configDir, err = configDir.Abs()
	if err != nil {
		return util.Path{}, err
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
			return accounts, fmt.Errorf("missing server name in rsconnect account")
		}
		url, ok := serverNameToURL[serverName]
		if !ok {
			return accounts, fmt.Errorf("Account references nonexistent server name '%s'", serverName)
		}
		account := Account{
			Source:      AccountSourceRsconnect,
			ServerType:  serverTypeFromURL(url),
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
		return nil, fmt.Errorf("error getting rsconnect config directory: %w", err)
	}
	exists, err := configDir.Exists()
	if err == nil && exists {
		return p.loadFromConfigDir(configDir)
	}
	p.debugLogger.Debugf("rsconnect config directory '%s' does not exist, checking old config directory", configDir)
	oldConfigDir, err := p.oldConfigDir()
	if err != nil {
		return nil, err
	}
	exists, err = oldConfigDir.Exists()
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
func (p *rsconnectProvider) loadFromConfigDir(configDir util.Path) ([]Account, error) {
	p.logger.Infof("Loading rsconnect accounts from %s", configDir)
	rscServers, err := p.dcfReader.ReadFiles(configDir.Join("servers"), "*.dcf")
	if err != nil {
		return nil, err
	}
	rscAccounts, err := p.dcfReader.ReadFiles(configDir.Join("accounts", "*"), "*.dcf")
	if err != nil {
		return nil, err
	}
	accounts, err := p.accountsFromConfig(rscServers, rscAccounts)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}
