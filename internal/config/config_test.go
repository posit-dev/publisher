package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"io/fs"
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/interpreters"
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

func setupNewPythonInterpreterMock() interpreters.PythonInterpreter {
	i := interpreters.NewMockPythonInterpreter()
	i.On("IsPythonExecutableValid").Return(true)
	i.On("GetPythonExecutable").Return(util.NewAbsolutePath("/bin/python", nil), nil)
	i.On("GetPythonVersion").Return("4.3.1", nil)
	i.On("GetPythonPackageFile").Return("requirements.txt")
	i.On("GetPythonPackageManager").Return("pip")
	return i
}

func setupNewRInterpreterMock() interpreters.RInterpreter {
	i := interpreters.NewMockRInterpreter()
	i.On("IsRExecutableValid").Return(true)
	i.On("GetRExecutable").Return(util.NewAbsolutePath("/bin/r", nil), nil)
	i.On("GetRVersion").Return("3.3.3", nil)
	i.On("GetPackageManager").Return("renv")
	i.On("GetLockFilePath").Return(util.NewRelativePath("renv.lock", nil), false, nil)
	return i
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
	s.Equal([]string{}, cfg.Files)
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
	cfg, err := FromFile(path, nil, nil)
	s.NoError(err)
	s.NotNil(cfg)
	s.Equal(ContentTypePythonDash, cfg.Type)
}

func (s *ConfigSuite) TestFromExampleFile() {
	realDir, err := util.Getwd(nil)
	s.NoError(err)
	path := realDir.Join("..", "schema", "schemas", "config.toml")
	cfg, err := FromFile(path, nil, nil)
	s.NoError(err)
	s.NotNil(cfg)

	valuePtr := cfg.Connect.Kubernetes.DefaultPyEnvironmentManagement
	s.NotNil(valuePtr)
	s.Equal(true, *valuePtr)
}

func (s *ConfigSuite) TestFromFileFillsDefaultsForPython() {
	configFile := GetConfigPath(s.cwd, "defaults")
	cfg := New()
	cfg.Type = "python-streamlit"
	cfg.Entrypoint = "app.py"
	cfg.Python = &Python{
		Version: "3.4.5",
	}
	err := cfg.WriteFile(configFile)
	s.NoError(err)

	python := setupNewPythonInterpreterMock()

	cfgFromFile, err := FromFile(configFile, nil, &python)
	s.NoError(err)
	s.NotNil(cfgFromFile)
	s.Equal(cfgFromFile.Python.PackageFile, "requirements.txt")
	s.Equal(cfgFromFile.Python.PackageManager, "pip")
}

func (s *ConfigSuite) TestFromFileFillsDefaultsForR() {
	configFile := GetConfigPath(s.cwd, "defaults")
	cfg := New()
	cfg.Type = "r-shiny"
	cfg.Entrypoint = "app.R"
	cfg.R = &R{
		Version: "4.4.1",
	}
	r := setupNewRInterpreterMock()

	err := cfg.WriteFile(configFile)
	s.NoError(err)

	cfgFromFile, err := FromFile(configFile, &r, nil)
	s.NoError(err)
	s.NotNil(cfgFromFile)
	s.Equal(cfgFromFile.R.PackageFile, "renv.lock")
	s.Equal(cfgFromFile.R.PackageManager, "renv")
}

func (s *ConfigSuite) TestFromFileErr() {
	cfg, err := FromFile(s.cwd.Join("nonexistent.toml"), nil, nil)
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
	_, err = FromFile(configFile, nil, nil)
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

	cfg, err := FromFile(configFile, nil, nil)
	s.NoError(err)

	s.Equal([]string{" These are comments.", " They will be preserved."}, cfg.Comments)
}

func (s *ConfigSuite) TestFillDefaultsDoesNotAddROrPythonSection() {
	cfg := New()
	cfg.FillDefaults()
	s.Nil(cfg.R)
	s.Nil(cfg.Python)
}

func (s *ConfigSuite) TestFillDefaultsAddsPackageFileAndPackageManager() {
	cfg := New()
	cfg.R = &R{Version: "4.4.1"}
	cfg.Python = &Python{Version: "3.12.7"}
	cfg.FillDefaults()

	s.NotNil(cfg.R)
	s.NotNil(cfg.Python)

	s.Equal(cfg.R.Version, "4.4.1")
	s.Equal(cfg.R.PackageFile, "renv.lock")
	s.Equal(cfg.R.PackageManager, "renv")

	s.Equal(cfg.Python.Version, "3.12.7")
	s.Equal(cfg.Python.PackageFile, "requirements.txt")
	s.Equal(cfg.Python.PackageManager, "pip")
}

func (s *ConfigSuite) TestFillDefaultsDoesNotOverwrite() {
	cfg := New()
	cfg.R = &R{Version: "4.4.1", PackageFile: "custom.lock", PackageManager: "custom"}
	cfg.Python = &Python{Version: "3.12.7", PackageFile: "custom.txt", PackageManager: "custom"}
	cfg.FillDefaults()

	s.NotNil(cfg.R)
	s.NotNil(cfg.Python)

	s.Equal(cfg.R.Version, "4.4.1")
	s.Equal(cfg.R.PackageFile, "custom.lock")
	s.Equal(cfg.R.PackageManager, "custom")

	s.Equal(cfg.Python.Version, "3.12.7")
	s.Equal(cfg.Python.PackageFile, "custom.txt")
	s.Equal(cfg.Python.PackageManager, "custom")
}

func (s *ConfigSuite) TestApplySecretActionAdd() {
	cfg := New()
	cfg.Secrets = []string{}
	err := cfg.AddSecret("secret1")
	s.NoError(err)
	s.Equal([]string{"secret1"}, cfg.Secrets)
}

func (s *ConfigSuite) TestApplySecretActionAddWithExistingSecrets() {
	cfg := New()
	cfg.Secrets = []string{"existingSecret1", "existingSecret2"}
	err := cfg.AddSecret("newSecret")
	s.NoError(err)
	s.Equal([]string{"existingSecret1", "existingSecret2", "newSecret"}, cfg.Secrets)
}

func (s *ConfigSuite) TestApplySecretActionAddNoDuplicates() {
	cfg := New()
	cfg.Secrets = []string{"existingSecret1", "existingSecret2"}

	err := cfg.AddSecret("existingSecret1")
	s.NoError(err)
	s.Equal([]string{"existingSecret1", "existingSecret2"}, cfg.Secrets)
}

func (s *ConfigSuite) TestApplySecretActionAddExitingEnvVar() {
	cfg := New()
	cfg.Environment = map[string]string{"existingEnvVar": "value"}
	cfg.Secrets = []string{}
	err := cfg.AddSecret("existingEnvVar")
	s.NotNil(err)
}

func (s *ConfigSuite) TestApplySecretActionRemove() {
	cfg := New()
	cfg.Secrets = []string{"secret1", "secret2"}
	err := cfg.RemoveSecret("secret1")
	s.NoError(err)
	s.Equal([]string{"secret2"}, cfg.Secrets)
}

func (s *ConfigSuite) TestApplySecretActionRemoveFromEmptySecrets() {
	cfg := New()
	cfg.Secrets = []string{}
	err := cfg.RemoveSecret("nonexistentSecret")
	s.NoError(err)
	s.Equal([]string{}, cfg.Secrets)
}
