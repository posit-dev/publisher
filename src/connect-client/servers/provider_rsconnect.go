package servers

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/util"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type rsconnectProvider struct{}

func newRSConnectProvider() provider {
	return &rsconnectProvider{}
}

// configDir returns the directory where the rsconnect
// R package stores its configuration.
func (p *rsconnectProvider) configDir() (string, error) {
	// https://github.com/rstudio/rsconnect/blob/main/R/config.R
	baseDir := os.Getenv("R_USER_CONFIG_DIR")
	if baseDir == "" {
		baseDir = os.Getenv("XDG_CONFIG_HOME")
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

// makeServerNameMap constructs a server name-to-url map
// from the provided rsconnect server list.
func makeServerNameMap(rscServers util.DCFData) map[string]string {
	serverNameToURL := map[string]string{}
	for _, rscServer := range rscServers {
		name := rscServer["name"]
		url := strings.TrimSuffix(rscServer["url"], "/__api__")
		serverNameToURL[name] = url
	}
	return serverNameToURL
}

// serversFromConfig constructs Server objects from the
// provided rsconnect server and account lists. Primarily,
// this is a join between the two on account.server = server.name.
func (p *rsconnectProvider) serversFromConfig(rscServers, rscAccounts util.DCFData) ([]Server, error) {
	servers := []Server{}
	serverNameToURL := makeServerNameMap(rscServers)
	for _, account := range rscAccounts {
		serverName := account["server"]
		if serverName == "" {
			return servers, fmt.Errorf("Missing server name in account %v", account)
		}
		url, ok := serverNameToURL[serverName]
		if !ok {
			return servers, fmt.Errorf("Account references nonexistent server name '%s'", serverName)
		}
		server := Server{
			Source:      ServerSourceRsconnect,
			Type:        serverTypeFromURL(url),
			Name:        serverName,
			URL:         url,
			AccountName: account["username"],
			Token:       account["token"],
			Secret:      account["private_key"],
		}
		if server.Token != "" && server.Secret != "" {
			server.AuthType = ServerAuthToken
		} else {
			server.AuthType = ServerAuthNone
		}
		servers = append(servers, server)
	}
	return servers, nil
}

// Load loads the list of servers stored by
// rsconnect, by reading its servers and account DCF files.
func (p *rsconnectProvider) Load() ([]Server, error) {
	configDir, err := p.configDir()
	if err != nil {
		return nil, err
	}
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
	servers, err := p.serversFromConfig(rscServers, rscAccounts)
	if err != nil {
		return nil, err
	}
	return servers, nil
}
