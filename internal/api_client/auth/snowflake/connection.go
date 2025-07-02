package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/spf13/afero"
)

// Connection represents the configuration options we need to do keypair auth
// with Snowflake.
type Connection struct {
	Account        string
	User           string
	PrivateKeyFile string `toml:"private_key_file"`
	Token          string
	Authenticator  string

	// private_key_path is an alternate way to specify the key file...
	PrivateKeyPath string `toml:"private_key_path"`
}

type Connections interface {
	Get(name string) (*Connection, error)
	List() (map[string]*Connection, error)
}

type defaultConnections struct {
	// default leaves this nil, meaning we will use util.osFs.
	// Overridden for testing.
	fs afero.Fs
}

// enforce interface compliance
var _ Connections = defaultConnections{}

func NewConnections() defaultConnections {
	return defaultConnections{}
}

// Get tries to find a snowflake connection by name.
func (c defaultConnections) Get(name string) (*Connection, error) {
	conns, err := c.List()
	if err != nil {
		return &Connection{}, err
	}

	if conn, ok := conns[name]; ok {
		return conn, nil
	}
	return &Connection{}, fmt.Errorf("connection %s not found", name)
}

// parseConfigToml parses a config.toml file and extracts Snowflake connections.
// In config.toml, connections are under sections like [connections.default].
func (c defaultConnections) parseConfigToml(f afero.File) (map[string]*Connection, error) {
	type configFile struct {
		Connections map[string]*Connection `toml:"connections"`
	}

	var config configFile
	dec := toml.NewDecoder(f)
	err := dec.Decode(&config)
	if err != nil {
		return nil, err
	}

	return config.Connections, nil
}

// parseConnectionsToml parses a connections.toml file.
// In connections.toml, each connection is a top-level section like [default].
func (c defaultConnections) parseConnectionsToml(f afero.File) (map[string]*Connection, error) {
	var conns map[string]*Connection
	dec := toml.NewDecoder(f)
	err := dec.Decode(&conns)
	if err != nil {
		return nil, err
	}

	return conns, nil
}

// envVarName creates the environment variable name for a connection field.
// Format: SNOWFLAKE_CONNECTIONS_<CONNECTION_NAME>_<FIELD_NAME>
func envVarName(connectionName, fieldName string) string {
	return fmt.Sprintf("SNOWFLAKE_CONNECTIONS_%s_%s",
		strings.ToUpper(connectionName),
		strings.ToUpper(fieldName))
}

// applyEnvVarOverrides updates connection fields from environment variables.
func applyEnvVarOverrides(conns map[string]*Connection) {
	for name, conn := range conns {
		// Check for Account override
		if value, exists := os.LookupEnv(envVarName(name, "Account")); exists {
			conn.Account = value
		}
		// Check for User override
		if value, exists := os.LookupEnv(envVarName(name, "User")); exists {
			conn.User = value
		}
		// Check for PrivateKeyFile override
		if value, exists := os.LookupEnv(envVarName(name, "Private_Key_File")); exists {
			conn.PrivateKeyFile = value
		}
		// Check for Token override
		if value, exists := os.LookupEnv(envVarName(name, "Token")); exists {
			conn.Token = value
		}
		// Check for Authenticator override
		if value, exists := os.LookupEnv(envVarName(name, "Authenticator")); exists {
			conn.Authenticator = value
		}
		// Check for PrivateKeyPath override
		if value, exists := os.LookupEnv(envVarName(name, "Private_Key_Path")); exists {
			conn.PrivateKeyPath = value
		}
	}
}

// List returns all configured Snowflake connections.
func (c defaultConnections) List() (map[string]*Connection, error) {
	// TODO: consider rstudio/snowflake-lib. But it doesn't have a released version.

	path, isConfigToml, err := c.connectionsPath()
	if err != nil {
		return nil, err
	}

	f, err := path.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Parse the file based on its type
	var conns map[string]*Connection
	if isConfigToml {
		// Parse config.toml format
		conns, err = c.parseConfigToml(f)
	} else {
		// Parse connections.toml format
		conns, err = c.parseConnectionsToml(f)
	}

	if err != nil {
		return nil, err
	}

	// handle optional secondary key file field
	for _, conn := range conns {
		if conn.PrivateKeyFile == "" && conn.PrivateKeyPath != "" {
			conn.PrivateKeyFile = conn.PrivateKeyPath
		}
	}

	// Apply environment variable overrides
	applyEnvVarOverrides(conns)

	return conns, nil
}

// connectionsPath searches possible snowflake config paths in priority order
// and returns the path of the first connections.toml or config.toml file it finds.
// connections.toml takes priority over config.toml.
func (c defaultConnections) connectionsPath() (util.AbsolutePath, bool, error) {
	var path util.AbsolutePath
	// First try to find connections.toml
	for _, dir := range c.findConfigDirs() {
		path = dir.Join("connections.toml")
		if ok, _ := path.Exists(); ok {
			return path, false, nil
		}
	}

	// If connections.toml is not found, try config.toml
	for _, dir := range c.findConfigDirs() {
		path = dir.Join("config.toml")
		if ok, _ := path.Exists(); ok {
			return path, true, nil
		}
	}

	return util.AbsolutePath{}, false, errors.New("unable to find a connections.toml or config.toml")
}

// findConfigDirs returns potential config directories for Snowflake connections.
//
// Includes `$SNOWFLAKE_HOME`, `~/.snowflake`, and `$XDG_CONFIG_HOME` if those
// env vars exist, followed by platform-specific defaults.
//
// See
// https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#connecting-using-the-connections-toml-file
func (c defaultConnections) findConfigDirs() []util.AbsolutePath {
	var dirs []util.AbsolutePath

	if sfh := os.Getenv("SNOWFLAKE_HOME"); sfh != "" {
		dirs = append(dirs, util.NewAbsolutePath(sfh, c.fs))
	}

	home, homeerr := os.UserHomeDir()
	if homeerr == nil {
		dirs = append(
			dirs,
			util.NewAbsolutePath(home, c.fs).Join(".snowflake"),
		)
	}

	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		dirs = append(
			dirs,
			util.NewAbsolutePath(xdg, c.fs).Join("snowflake"),
		)
	}

	if homeerr == nil {
		switch runtimeGOOS {
		case "windows":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, c.fs).Join("AppData", "Local", "snowflake"),
			)
		case "darwin":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, c.fs).Join("Library", "Application Support", "snowflake"),
			)
		case "linux":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, c.fs).Join(".config", "snowflake"),
			)

		}
	}

	return dirs
}

// overridable by tests
var runtimeGOOS = runtime.GOOS
