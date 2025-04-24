package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"runtime"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/util"
)

// config_dir The directory to search for a `connections.toml` and
// `config.toml` file. Defaults to `$SNOWFLAKE_HOME` or `~/.snowflake` if that
// directory exists, otherwise it falls back to a platform-specific default.
// See [Snowflake's
// documentation](https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#connecting-using-the-connections-toml-file)

// - SNOWFLAKE_HOME
// - ~/.snowflake
// - XDG_CONFIG_HOME/snowflake
// - Linux: ~/.config/snowflake/connections.toml, but you can update it with XDG vars
//   unix = "~/.config/snowflake"
// - Windows: %USERPROFILE%\AppData\Local\snowflake\connections.toml
//   win = file.path(Sys.getenv("LOCALAPPDATA"), "snowflake"),
// - Mac: ~/Library/Application Support/snowflake/connections.toml
//   mac = "~/Library/Application Support/snowflake",

// load connection details for name
// requires find all connections
// requires find config dir

// allow tests to override runtime.GOOS
var runtimeGOOS = func() string {
	return runtime.GOOS
}

// Returns the default config directory for Snowflake connections.
//
// https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect#connecting-using-the-connections-toml-file
func findConfigDir() string {
	// home <- Sys.getenv("SNOWFLAKE_HOME", "~/.snowflake")
	//  if (dir.exists(home)) {
	//    return(home)
	//  }
	//  if (nzchar(env <- Sys.getenv("XDG_CONFIG_HOME"))) {
	//    return(file.path(env, "snowflake"))
	//  }
	//  # System-specific paths.
	//  if (is.null(os)) {
	//    if (.Platform$OS.type == "windows") {
	//      os <- "win"
	//    } else if (Sys.info()["sysname"] == "Darwin") {
	//      os <- "mac"
	//    } else {
	//      os <- "unix"
	//    }
	//  }
	//  switch(
	//    os,
	//    win = file.path(Sys.getenv("LOCALAPPDATA"), "snowflake"),
	//    mac = "~/Library/Application Support/snowflake",
	//    unix = "~/.config/snowflake"
	//  )
	switch runtimeGOOS() {
	case "windows":
		// feels like we should use os.UserHomeDir() here, but I'm
		// using what the Snowflake docs say they use
		return `%USERPROFILE%\AppData\Local\snowflake`
	case "darwin":
		return "~/Library/Application Support/snowflake"
	case "linux":
		return "~/.config/snowflake"

	}
	return ""
}

type Connection struct {
	Account        string
	User           string
	PrivateKeyFile string `toml:"private_key_file"`
}

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

func GetConnections() (map[string]Connection, error) {
	var conns map[string]Connection

	// TODO: consider rstudio/snowflake-lib. Right now `go get` is failing
	// to import it for some reason.

	// util.ReadTOMLFile uses strict parsing, but we want to ignore a bunch
	// of connections.toml fields that we don't care about, so we make our
	// own decoder here.
	path := util.NewAbsolutePath("/Users/chris/.snowflake/connections.toml", nil)
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
