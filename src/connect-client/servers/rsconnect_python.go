package servers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// Returns the path to rsconnect-python's configuration directory.
// The config directory is where the server list (servers.json) is
// stored, along with deployment metadata for any deployements that
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

// Infers a server type from the server URL.
// For Posit-deployed servers (shinyapps.io, posit.cloud)
// it returns the corresponding type. Otherwise,
// it assumes a Connect server.
func serverTypeFromURL(url string) ServerType {
	switch url {
	case "https://api.posit.cloud":
		return ServerTypeCloud
	case "https://api.rstudio.cloud":
		return ServerTypeCloud
	case "https://api.shinyapps.io":
		return ServerTypeShinyappsIO
	default:
		return ServerTypeConnect
	}
}

// Loads the list of servers stored by rsconnect-python
// by reading its servers.json file.
func ReadRsconnectPythonServers() (ServerList, error) {
	path, err := rsconnectPythonServerListPath()
	if err != nil {
		return ServerList{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return ServerList{}, nil
		}
		return ServerList{}, err
	}

	// rsconnect-python stores a map of nicknames to servers
	var serverMap map[string]Server
	err = json.Unmarshal(data, &serverMap)
	if err != nil {
		return ServerList{}, err
	}
	var serverList ServerList
	for _, server := range serverMap {
		serverList = append(serverList, server)
	}

	// rsconnect-python does not store the server
	// type, so infer it from the URL.
	for i := range serverList {
		server := &serverList[i]
		server.Type = serverTypeFromURL(server.URL)
		if server.Type == ServerTypeCloud && server.URL == "https://api.rstudio.cloud" {
			// Migrate existing rstudio.cloud entries.
			server.URL = "https://api.posit.cloud"
		}
	}
	return serverList, nil
}
