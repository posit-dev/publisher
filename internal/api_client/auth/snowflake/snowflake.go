package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"
	"runtime"

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

// List returns all configured Snowflake connections.
func (c defaultConnections) List() (map[string]*Connection, error) {
	// We don't know in advance what the Connection names will be, so we
	// must decode into a map rather than a struct.
	var conns map[string]*Connection

	// TODO: consider rstudio/snowflake-lib. But it doesn't have a released version.

	// util.ReadTOMLFile uses strict parsing, but we want to ignore a bunch
	// of connections.toml fields that we don't care about, so we make our
	// own decoder here.

	path, err := c.connectionsPath()
	if err != nil {
		return nil, err
	}

	f, err := path.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	dec := toml.NewDecoder(f)
	err = dec.Decode(&conns)
	if err != nil {
		return nil, err
	}

	// handle optional secondary key file field
	for _, conn := range conns {
		if conn.PrivateKeyFile == "" && conn.PrivateKeyPath != "" {
			conn.PrivateKeyFile = conn.PrivateKeyPath
		}
	}

	return conns, nil
}

// connectionsPath searches possible snowflake config paths in priority order
// and returns the path of the first connections.toml file it finds.
func (c defaultConnections) connectionsPath() (util.AbsolutePath, error) {
	var path util.AbsolutePath
	for _, dir := range c.findConfigDirs() {
		path = dir.Join("connections.toml")
		if ok, _ := path.Exists(); ok {
			return path, nil
		}
	}
	return util.AbsolutePath{}, errors.New("unable to find a connections.toml")
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
