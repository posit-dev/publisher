package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"
	"runtime"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/util"
)

// Connection represents the configuration options we need to do keypair auth
// with Snowflake.
type Connection struct {
	Account        string
	User           string
	PrivateKeyFile string `toml:"private_key_file"`
}

// GetConnection tries to find a snowflake connection by name.
func GetConnection(name string) (Connection, error) {
	conns, err := GetConnections()
	if err != nil {
		return Connection{}, err
	}

	if conn, ok := conns[name]; ok {
		return conn, nil
	}
	return Connection{}, fmt.Errorf("connection %s not found", name)
}

// GetConnections returns all configured Snowflake connections.
func GetConnections() (map[string]Connection, error) {
	// We don't know in advance what the Connection names will be, so we
	// must decode into a map rather than a struct.
	var conns map[string]Connection

	// TODO: consider rstudio/snowflake-lib. But it doesn't have a released version.

	// util.ReadTOMLFile uses strict parsing, but we want to ignore a bunch
	// of connections.toml fields that we don't care about, so we make our
	// own decoder here.

	path, err := connectionsPath()
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

	return conns, nil
}

// connectionsPath searches possible snowflake config paths in priority order
// and returns the path of the first connections.toml file it finds.
func connectionsPath() (util.AbsolutePath, error) {
	var path util.AbsolutePath
	for _, dir := range findConfigDirs() {
		path = dir.Join("connections.toml")
		if ok, _ := path.Exists(); ok {
			return path, nil
		}
	}
	// return first one with a connections file
	return util.AbsolutePath{}, errors.New("unable to find a connections.toml")
}

// findConfigDirs returns potential config directories for Snowflake connections.
//
// Includes `$SNOWFLAKE_HOME`, `~/.snowflake`, and `$XDG_CONFIG_HOME` if those
// env vars exist, followed by platform-specific defaults.
//
// See
// https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#connecting-using-the-connections-toml-file
func findConfigDirs() []util.AbsolutePath {
	var dirs []util.AbsolutePath

	if sfh, set := os.LookupEnv("SNOWFLAKE_HOME"); set && sfh != "" {
		dirs = append(dirs, util.NewAbsolutePath(sfh, nil))
	}

	home, homeerr := os.UserHomeDir()
	if homeerr == nil {
		dirs = append(
			dirs,
			util.NewAbsolutePath(home, nil).Join(".snowflake"),
		)
	}

	if xdg, set := os.LookupEnv("XDG_CONFIG_HOME"); set && xdg != "" {
		dirs = append(
			dirs,
			util.NewAbsolutePath(xdg, nil).Join("snowflake"),
		)
	}

	if homeerr == nil {
		switch runtime.GOOS {
		case "windows":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, nil).Join(`AppData\Local\snowflake`),
			)
		case "darwin":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, nil).Join("Library/Application Support/snowflake"),
			)
		case "linux":
			dirs = append(
				dirs,
				util.NewAbsolutePath(home, nil).Join(".config/snowflake"),
			)

		}
	}

	return dirs
}
