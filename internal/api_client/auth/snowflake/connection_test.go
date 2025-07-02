package snowflake

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ConnectionSuite struct {
	utiltest.Suite
	envVarHelper utiltest.EnvVarHelper
}

func TestConnectionSuite(t *testing.T) {
	suite.Run(t, new(ConnectionSuite))
}

func (s *ConnectionSuite) SetupTest() {
	s.envVarHelper.Setup("SNOWFLAKE_HOME", "XDG_CONFIG_HOME")
}

func (s *ConnectionSuite) TearDownTest() {
	runtimeGOOS = runtime.GOOS

	s.envVarHelper.Teardown()
}

var connectionsToml = []byte(`
[default]
account = "default-acct"
user = "default-user"
authenticator = "SNOWFLAKE_JWT"
private_key_file = "/tmp/default/rsa_key.p8"

[other]
account = "other-acct"
user = "other-user"
authenticator = "SNOWFLAKE_JWT"
private_key_file = "/tmp/other/rsa_key.p8"

[path]
account = "path-acct"
user = "path-user"
authenticator = "SNOWFLAKE_JWT"
private_key_path = "/tmp/path/rsa_key.p8"

[workbench]
account = "workbench-acct"
token = "workbench-token"
authenticator = "oauth"
`)

// this file should never be loaded, as the other will be higher in priority
var otherToml = []byte(`
[notloaded]
account = "notloaded-acct"
`)

func (s *ConnectionSuite) TestList() {
	// tmp is a convenient root that will reflect the naming conventions of
	// whatever OS we are running on
	tmp := os.TempDir()

	home, err := os.UserHomeDir()
	s.NoError(err)

	for name, test := range map[string]struct {
		GOOS       string
		xdghome    string
		sfhome     string
		filepath   string
		secondpath string
	}{
		"windows default path": {
			GOOS:       "windows",
			filepath:   filepath.Join(home, "AppData", "Local", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},
		"windows xdg_config_home": {
			GOOS:       "windows",
			xdghome:    filepath.Join(tmp, "xdg"),
			filepath:   filepath.Join(tmp, "xdg", "snowflake"),
			secondpath: filepath.Join(home, "AppData", "Local", "snowflake"),
		},
		"windows user homedir": {
			GOOS:       "windows",
			filepath:   filepath.Join(home, ".snowflake"),
			secondpath: filepath.Join(home, "AppData", "Local", "snowflake"),
		},
		"windows snowflake_home": {
			GOOS:       "windows",
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(tmp, "snowflake"),
			secondpath: filepath.Join(home, ".snowflake"),
		},
		"windows skips empty env var dirs": {
			GOOS:       "windows",
			xdghome:    filepath.Join(tmp, "xdg"),
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(home, "AppData", "Local", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},

		"darwin default path": {
			GOOS:       "darwin",
			filepath:   filepath.Join(home, "Library", "Application Support", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},
		"darwin xdg_config_home": {
			GOOS:       "darwin",
			xdghome:    filepath.Join(tmp, "xdg"),
			filepath:   filepath.Join(tmp, "xdg", "snowflake"),
			secondpath: filepath.Join(home, "Library", "Application Support", "snowflake"),
		},
		"darwin user homedir": {
			GOOS:       "darwin",
			filepath:   filepath.Join(home, ".snowflake"),
			secondpath: filepath.Join(home, "Library", "Application Support", "snowflake"),
		},
		"darwin snowflake_home": {
			GOOS:       "darwin",
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(tmp, "snowflake"),
			secondpath: filepath.Join(home, ".snowflake"),
		},
		"darwin skips empty env var dirs": {
			GOOS:       "darwin",
			xdghome:    filepath.Join(tmp, "xdg"),
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(home, "Library", "Application Support", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},

		"linux default path": {
			GOOS:       "linux",
			filepath:   filepath.Join(home, ".config", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},
		"linux xdg_config_home": {
			GOOS:       "linux",
			xdghome:    filepath.Join(tmp, "xdg"),
			filepath:   filepath.Join(tmp, "xdg", "snowflake"),
			secondpath: filepath.Join(home, ".config", "snowflake"),
		},
		"linux user homedir": {
			GOOS:       "linux",
			filepath:   filepath.Join(home, ".snowflake"),
			secondpath: filepath.Join(home, ".config", "snowflake"),
		},
		"linux snowflake_home": {
			GOOS:       "linux",
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(tmp, "snowflake"),
			secondpath: filepath.Join(home, ".snowflake"),
		},
		"linux skips empty env var dirs": {
			GOOS:       "linux",
			xdghome:    filepath.Join(tmp, "xdg"),
			sfhome:     filepath.Join(tmp, "snowflake"),
			filepath:   filepath.Join(home, ".config", "snowflake"),
			secondpath: filepath.Join(tmp, "irrelevant"), // no lower priority option
		},
	} {
		runtimeGOOS = test.GOOS

		if test.sfhome == "" {
			os.Unsetenv("SNOWFLAKE_HOME")
		} else {
			os.Setenv("SNOWFLAKE_HOME", test.sfhome)
		}
		if test.xdghome == "" {
			os.Unsetenv("XDG_CONFIG_HOME")
		} else {
			os.Setenv("XDG_CONFIG_HOME", test.xdghome)
		}

		fs := afero.NewMemMapFs()
		fs.MkdirAll(test.filepath, 0755)
		afero.WriteFile(fs, filepath.Join(test.filepath, "connections.toml"), connectionsToml, 0600)
		afero.WriteFile(fs, filepath.Join(test.secondpath, "connections.toml"), otherToml, 0600)

		dc := defaultConnections{
			fs: fs,
		}

		conns, err := dc.List()
		s.NoError(err, name)
		s.Equal(map[string]*Connection{
			"default": {
				Account:        "default-acct",
				User:           "default-user",
				PrivateKeyFile: "/tmp/default/rsa_key.p8",
				PrivateKeyPath: "",
				Authenticator:  "SNOWFLAKE_JWT",
			},
			"other": {
				Account:        "other-acct",
				User:           "other-user",
				PrivateKeyFile: "/tmp/other/rsa_key.p8",
				PrivateKeyPath: "",
				Authenticator:  "SNOWFLAKE_JWT",
			},
			"path": {
				Account:        "path-acct",
				User:           "path-user",
				PrivateKeyFile: "/tmp/path/rsa_key.p8",
				PrivateKeyPath: "/tmp/path/rsa_key.p8",
				Authenticator:  "SNOWFLAKE_JWT",
			},
			"workbench": {
				Account:       "workbench-acct",
				Token:         "workbench-token",
				Authenticator: "oauth",
			},
		}, conns, name)
	}
}

func (s *ConnectionSuite) TestListErr() {
	// fs containing no connections.toml
	fs := afero.NewMemMapFs()

	dc := defaultConnections{
		fs: fs,
	}

	conns, err := dc.List()
	s.ErrorContains(err, "unable to find a connections.toml")
	s.Nil(conns)
}

func (s *ConnectionSuite) TestGet() {
	tmp := os.TempDir()
	sfhome := filepath.Join(tmp, "snowflake")
	os.Setenv("SNOWFLAKE_HOME", sfhome)
	fs := afero.NewMemMapFs()
	fs.MkdirAll(sfhome, 0755)
	afero.WriteFile(fs, filepath.Join(sfhome, "connections.toml"), connectionsToml, 0600)

	dc := defaultConnections{
		fs: fs,
	}

	conn, err := dc.Get("default")
	s.NoError(err)
	s.Equal(&Connection{
		Account:        "default-acct",
		User:           "default-user",
		PrivateKeyFile: "/tmp/default/rsa_key.p8",
		PrivateKeyPath: "",
		Authenticator:  "SNOWFLAKE_JWT",
	}, conn)

	conn, err = dc.Get("other")
	s.NoError(err)
	s.Equal(&Connection{
		Account:        "other-acct",
		User:           "other-user",
		PrivateKeyFile: "/tmp/other/rsa_key.p8",
		PrivateKeyPath: "",
		Authenticator:  "SNOWFLAKE_JWT",
	}, conn)

	conn, err = dc.Get("path")
	s.NoError(err)
	s.Equal(&Connection{
		Account:        "path-acct",
		User:           "path-user",
		PrivateKeyFile: "/tmp/path/rsa_key.p8",
		PrivateKeyPath: "/tmp/path/rsa_key.p8",
		Authenticator:  "SNOWFLAKE_JWT",
	}, conn)

	conn, err = dc.Get("workbench")
	s.NoError(err)
	s.Equal(&Connection{
		Account:       "workbench-acct",
		Token:         "workbench-token",
		Authenticator: "oauth",
	}, conn)

	conn, err = dc.Get("notloaded")
	s.ErrorContains(err, "connection notloaded not found")
	s.Equal(&Connection{}, conn)
}

func (s *ConnectionSuite) TestGetErr() {
	// fs containing no connections.toml
	fs := afero.NewMemMapFs()

	dc := defaultConnections{
		fs: fs,
	}

	conn, err := dc.Get("any")
	s.ErrorContains(err, "unable to find a connections.toml")
	s.Equal(&Connection{}, conn)
}
