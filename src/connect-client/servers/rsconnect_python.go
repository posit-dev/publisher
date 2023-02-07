package servers

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// Returns the path to rsconnect-python's configuration directory.
// The config directory is where the server list (servers.json) is
// stored, along with deployment metadata for any deployments that
// were made from read-only directories.
func rsconnectPythonConfigDir() (string, error) {
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
func rsconnectPythonServerListPath() (string, error) {
	dir, err := rsconnectPythonConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "servers.json"), nil
}

func decodeRSConnectPythonServerStore(data []byte) ([]Server, error) {
	// rsconnect-python stores a map of nicknames to servers
	var serverMap map[string]Server
	err := json.Unmarshal(data, &serverMap)
	if err != nil {
		return []Server{}, err
	}

	servers := []Server{}
	for _, server := range serverMap {
		server.Source = ServerSourceRSCP

		// rsconnect-python does not store the server
		// type, so infer it from the URL.
		server.Type = serverTypeFromURL(server.URL)

		if server.ApiKey != "" {
			server.AuthType = ServerAuthAPIKey
		} else if server.Token != "" && server.Secret != "" {
			server.AuthType = ServerAuthToken
		} else {
			server.AuthType = ServerAuthNone
		}

		// Migrate existing rstudio.cloud entries.
		if server.URL == "https://api.rstudio.cloud" {
			server.URL = "https://api.posit.cloud"
		}
		servers = append(servers, server)
	}
	return servers, nil
}

// Loads the list of servers stored by rsconnect-python
// by reading its servers.json file.
func (l *ServerList) loadRSConnectPythonServers() error {
	path, err := rsconnectPythonServerListPath()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	servers, err := decodeRSConnectPythonServerStore(data)
	if err != nil {
		return err
	}
	l.servers = append(l.servers, servers...)
	return nil
}
