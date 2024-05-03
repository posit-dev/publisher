package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"runtime"
	"sort"
	"strings"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/dcf"

	"github.com/spf13/afero"
)

type rsconnectProvider struct {
	fs        afero.Fs
	goos      string
	dcfReader dcf.FileReader
	log       logging.Logger
}

func newRSConnectProvider(fs afero.Fs, log logging.Logger) *rsconnectProvider {
	return &rsconnectProvider{
		fs:        fs,
		goos:      runtime.GOOS,
		dcfReader: dcf.NewFileReader(nil),
		log:       log,
	}
}

// configDir returns the directory where the rsconnect
// R package stores its configuration.
func (p *rsconnectProvider) configDir() (util.AbsolutePath, error) {
	// https://github.com/rstudio/rsconnect/blob/main/R/config.R
	baseDir := util.PathFromEnvironment("R_USER_CONFIG_DIR", p.fs)
	if baseDir.String() != "" {
		p.log.Debug("rsconnect: using R_USER_CONFIG_DIR", "path", baseDir)
	} else {
		baseDir = util.PathFromEnvironment("XDG_CONFIG_HOME", p.fs)
		if baseDir.String() != "" {
			p.log.Debug("rsconnect: using XDG_CONFIG_HOME", "path", baseDir)
		}
	}
	if baseDir.String() == "" {
		switch p.goos {
		case "windows":
			baseDir = util.PathFromEnvironment("APPDATA", p.fs).Join("R", "config")
		case "darwin":
			home, err := util.UserHomeDir(p.fs)
			if err != nil {
				return util.AbsolutePath{}, err
			}
			baseDir = home.Join("Library", "Preferences", "org.R-project.R").Path
		default:
			home, err := util.UserHomeDir(p.fs)
			if err != nil {
				return util.AbsolutePath{}, err
			}
			baseDir = home.Join(".config").Path
		}
	}
	return baseDir.Join("R", "rsconnect").Abs()
}

func (p *rsconnectProvider) oldConfigDir() (util.AbsolutePath, error) {
	home, err := util.UserHomeDir(p.fs)
	if err != nil {
		return util.AbsolutePath{}, err
	}
	configDir := util.PathFromEnvironment("R_USER_CONFIG_DIR", p.fs)

	if configDir.String() != "" {
		p.log.Debug("rsconnect: using R_USER_CONFIG_DIR", "path", configDir)
		configDir = configDir.Join("rsconnect")
	} else {
		switch p.goos {
		case "windows":
			configDir = util.PathFromEnvironment("APPDATA", p.fs)
		case "darwin":
			configDir = home.Join("Library", "Application Support").Path
		default:
			configDir = util.PathFromEnvironment("XDG_CONFIG_HOME", p.fs)
			if configDir.String() != "" {
				p.log.Debug("rsconnect: using XDG_CONFIG_HOME", "path", configDir)
			} else {
				configDir = home.Join(".config").Path
			}
		}
		configDir = configDir.Join("R", "rsconnect")
	}
	p.log.Debug("rsconnect: candidate old config directory", "path", configDir)
	return configDir.Abs()
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
		serverURL, err := normalizeServerURL(url)
		if err != nil {
			return nil, err
		}
		account := Account{
			Source:      AccountSourceRsconnect,
			ServerType:  serverTypeFromURL(serverURL),
			Name:        serverName,
			URL:         serverURL,
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
	p.log.Debug("rsconnect config directory does not exist, checking old config directory", "path", configDir)
	oldConfigDir, err := p.oldConfigDir()
	if err != nil {
		return nil, err
	}
	exists, err = oldConfigDir.Exists()
	if err != nil {
		return nil, err
	}
	if !exists {
		p.log.Debug("Old rsconnect config directory does not exist")
		return nil, nil
	}

	// TODO: afero doesn't support EvalSymlinks; make our own using fs.Lstat?
	// oldConfigDir, err = filepath.EvalSymlinks(oldConfigDir)
	// if err != nil {
	// 	if errors.Is(err, fs.ErrNotExist) {
	// 		p.log.Debug("Old rsconnect config directory does not exist")
	// 		return nil, nil
	// 	} else {
	// 		return nil, fmt.Errorf("Error getting old rsconnect config directory: %s", err)
	// 	}
	// }
	return p.loadFromConfigDir(oldConfigDir)
}

// Load loads the list of accounts stored by
// rsconnect, by reading its servers and account DCF files.
func (p *rsconnectProvider) loadFromConfigDir(configDir util.AbsolutePath) ([]Account, error) {
	p.log.Info("Loading rsconnect accounts", "path", configDir)
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
