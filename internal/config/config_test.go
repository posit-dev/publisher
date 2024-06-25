package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"io/fs"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type ConfigSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestConfigSuite(t *testing.T) {
	suite.Run(t, new(ConfigSuite))
}

func (s *ConfigSuite) SetupTest() {
	fs := afero.NewMemMapFs()
	cwd, err := util.Getwd(fs)
	s.Nil(err)
	s.cwd = cwd
	s.cwd.MkdirAll(0700)
}

func (s *ConfigSuite) createConfigFile(name string) {
	configFile := GetConfigPath(s.cwd, name)
	cfg := New()
	cfg.Type = "python-dash"
	cfg.Entrypoint = "app.py"
	cfg.Python = &Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	err := cfg.WriteFile(configFile)
	s.NoError(err)
}

func (s *ConfigSuite) TestNew() {
	cfg := New()
	s.NotNil(cfg)
	s.Equal(schema.ConfigSchemaURL, cfg.Schema)
	s.Equal(true, cfg.Validate)
	s.Equal([]string{"*"}, cfg.Files)
}

func (s *ConfigSuite) TestGetConfigPath() {
	path := GetConfigPath(s.cwd, "myConfig")
	s.Equal(path, s.cwd.Join(".posit", "publish", "myConfig.toml"))
}

func (s *ConfigSuite) TestGetConfigPathEmpty() {
	path := GetConfigPath(s.cwd, "")
	s.Equal(path, s.cwd.Join(".posit", "publish", "default.toml"))
}

func (s *ConfigSuite) TestFromFile() {
	s.createConfigFile("myConfig")
	path := GetConfigPath(s.cwd, "myConfig")
	cfg, err := FromFile(path)
	s.NoError(err)
	s.NotNil(cfg)
	s.Equal(ContentTypePythonDash, cfg.Type)
}

func (s *ConfigSuite) TestFromExampleFile() {
	realDir, err := util.Getwd(nil)
	s.NoError(err)
	path := realDir.Join("..", "schema", "schemas", "config.toml")
	cfg, err := FromFile(path)
	s.NoError(err)
	s.NotNil(cfg)

	valuePtr := cfg.Connect.Kubernetes.DefaultPyEnvironmentManagement
	s.NotNil(valuePtr)
	s.Equal(true, *valuePtr)
}

func (s *ConfigSuite) TestFromFileErr() {
	cfg, err := FromFile(s.cwd.Join("nonexistent.toml"))
	s.ErrorIs(err, fs.ErrNotExist)
	s.Nil(cfg)
}

func (s *ConfigSuite) TestWriteFile() {
	configFile := GetConfigPath(s.cwd, "myConfig")
	cfg := New()
	err := cfg.WriteFile(configFile)
	s.NoError(err)
}

func (s *ConfigSuite) TestWriteFileEmptyEntrypoint() {
	configFile := GetConfigPath(s.cwd, "myConfig")
	cfg := New()
	cfg.Type = ContentTypeHTML
	cfg.Entrypoint = ""
	err := cfg.WriteFile(configFile)
	s.NoError(err)

	// Ensure it validates
	_, err = FromFile(configFile)
	s.NoError(err)

	contents, err := configFile.ReadFile()
	s.NoError(err)
	lines := strings.Split(string(contents), "\n")
	s.Contains(lines, "entrypoint = ''")

	s.NotContains(contents, []byte("has_parameters"))
}

func (s *ConfigSuite) TestWriteFileErr() {
	configFile := GetConfigPath(s.cwd, "myConfig")
	readonlyFs := afero.NewReadOnlyFs(configFile.Fs())
	readonlyFile := configFile.WithFs(readonlyFs)
	cfg := New()
	err := cfg.WriteFile(readonlyFile)
	s.NotNil(err)
}

func (s *ConfigSuite) TestWriteComments() {
	configFile := GetConfigPath(s.cwd, "myConfig")
	cfg := New()
	cfg.Comments = []string{" This is a comment.", " This is another comment."}
	err := cfg.WriteFile(configFile)
	s.NoError(err)

	contents, err := configFile.ReadFile()
	s.NoError(err)
	s.True(bytes.HasPrefix(contents, []byte("# This is a comment.\n# This is another comment.\n")))
}

const commentedConfig = `# These are comments.
# They will be preserved.
'$schema' = 'https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json'
type = 'html'
entrypoint = 'index.html'
`

func (s *ConfigSuite) TestReadComments() {
	configFile := GetConfigPath(s.cwd, "myConfig")
	err := configFile.WriteFile([]byte(commentedConfig), 0666)
	s.NoError(err)

	cfg, err := FromFile(configFile)
	s.NoError(err)

	s.Equal([]string{" These are comments.", " They will be preserved."}, cfg.Comments)
}
