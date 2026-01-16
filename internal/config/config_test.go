package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"io/fs"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
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

func (s *ConfigSuite) createConfigFile(name string, opts ...func(*Config)) {
	configFile := GetConfigPath(s.cwd, name)
	cfg := New()
	cfg.ProductType = "connect"
	cfg.Type = "python-dash"
	cfg.Entrypoint = "app.py"
	cfg.Python = &Python{
		Version:        "3.4.5",
		PackageManager: "pip",
	}
	for _, opt := range opts {
		opt(cfg)
	}
	err := cfg.WriteFile(configFile)
	s.NoError(err)
}

func (s *ConfigSuite) TestNew() {
	cfg := New()
	s.NotNil(cfg)
	s.Equal(schema.ConfigSchemaURL, cfg.Schema)
	s.Equal(true, cfg.GetValidate())
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
	cfg, err := FromFile(path)
	s.NoError(err)
	s.NotNil(cfg)
	s.Equal(contenttypes.ContentTypePythonDash, cfg.Type)
}

func (s *ConfigSuite) TestFromFileUnsupportedContentType() {
	s.createConfigFile("myConfig", func(cfg *Config) {
		cfg.ProductType = ProductTypeConnectCloud
		cfg.Type = contenttypes.ContentTypePythonFastAPI
		cfg.Python.PackageFile = ""
	})
	path := GetConfigPath(s.cwd, "myConfig")
	cfg, err := FromFile(path)
	s.ErrorContains(err, "python: additionalProperties 'package_manager' not allowed")
	s.Nil(cfg)
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

	s.Equal(ProductTypeConnect, cfg.ProductType, "ProductType should be set to its default value")
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
	cfg.ProductType = "connect"
	cfg.Type = contenttypes.ContentTypeHTML
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
product_type = 'connect'
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

func (s *ConfigSuite) TestForceProductTypeComplianceNonCloud() {
	// Test that nothing changes for non-Cloud product types
	cfg := &Config{
		ProductType: ProductTypeConnect,
		Python: &Python{
			Version:               "3.10.4",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9",
		},
		R: &R{
			Version:          "4.2.1",
			PackageManager:   "renv",
			PackageFile:      "renv.lock",
			RequiresRVersion: ">=4.0",
		},
	}

	// Make a copy to compare against
	original := &Config{
		ProductType: ProductTypeConnect,
		Python: &Python{
			Version:               "3.10.4",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9",
		},
		R: &R{
			Version:          "4.2.1",
			PackageManager:   "renv",
			PackageFile:      "renv.lock",
			RequiresRVersion: ">=4.0",
		},
	}

	// Call ForceProductTypeCompliance
	cfg.ForceProductTypeCompliance()

	// Verify nothing changed
	s.Equal(original.Python.Version, cfg.Python.Version, "Python version should not change")
	s.Equal(original.Python.PackageManager, cfg.Python.PackageManager, "Python package manager should not change")
	s.Equal(original.Python.PackageFile, cfg.Python.PackageFile, "Python package file should not change")
	s.Equal(original.Python.RequiresPythonVersion, cfg.Python.RequiresPythonVersion, "Python requires version should not change")

	s.Equal(original.R.Version, cfg.R.Version, "R version should not change")
	s.Equal(original.R.PackageManager, cfg.R.PackageManager, "R package manager should not change")
	s.Equal(original.R.PackageFile, cfg.R.PackageFile, "R package file should not change")
	s.Equal(original.R.RequiresRVersion, cfg.R.RequiresRVersion, "R requires version should not change")
}

func (s *ConfigSuite) TestForceProductTypeComplianceCloud() {
	// Test that fields are unset for Cloud product type
	hasParameters := true
	cfg := &Config{
		ProductType: ProductTypeConnectCloud,
		Python: &Python{
			Version:               "3.10.4",
			PackageManager:        "pip",
			PackageFile:           "requirements.txt",
			RequiresPythonVersion: ">=3.9",
		},
		R: &R{
			Version:          "4.2.1",
			PackageManager:   "renv",
			PackageFile:      "renv.lock",
			RequiresRVersion: ">=4.0",
		},
		HasParameters: &hasParameters,
	}

	// Call ForceProductTypeCompliance
	cfg.ForceProductTypeCompliance()

	// Verify Python fields are modified as expected
	s.Equal("3.10", cfg.Python.Version, "Python version should be in X.Y format")
	s.Equal("", cfg.Python.PackageManager, "Python package manager should be unset")
	s.Equal("", cfg.Python.PackageFile, "Python package file should be unset")
	s.Equal("", cfg.Python.RequiresPythonVersion, "Python requires version should be unset")

	// Verify R fields are modified as expected
	s.Equal("4.2.1", cfg.R.Version, "R version should remain unchanged")
	s.Equal("", cfg.R.PackageManager, "R package manager should be unset")
	s.Equal("", cfg.R.PackageFile, "R package file should be unset")
	s.Equal("", cfg.R.RequiresRVersion, "R requires version should be unset")

	s.Nil(cfg.HasParameters, "HasParameters should be unset")
}

func (s *ConfigSuite) TestForceProductTypeCompliancePythonVersionFormats() {
	// Test different Python version formats
	testCases := []struct {
		name           string
		inputVersion   string
		expectedOutput string
	}{
		{
			name:           "Major.Minor",
			inputVersion:   "3.10",
			expectedOutput: "3.10",
		},
		{
			name:           "Major.Minor.Patch",
			inputVersion:   "3.10.4",
			expectedOutput: "3.10",
		},
		{
			name:           "Major.Minor.Patch.Build",
			inputVersion:   "3.10.4.1",
			expectedOutput: "3.10",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			cfg := &Config{
				ProductType: ProductTypeConnectCloud,
				Python: &Python{
					Version: tc.inputVersion,
				},
			}

			// Call ForceProductTypeCompliance
			cfg.ForceProductTypeCompliance()

			// Verify Python version is in the expected format
			s.Equal(tc.expectedOutput, cfg.Python.Version, "Python version should be in X.Y format")
		})
	}
}

func (s *ConfigSuite) TestForceProductTypeComplianceNilFields() {
	// Test with nil Python and R fields
	cfg := &Config{
		ProductType: ProductTypeConnectCloud,
		// No Python or R fields
	}

	// Call ForceProductTypeCompliance
	cfg.ForceProductTypeCompliance()

	// Verify no panic occurred and fields are still nil
	s.Nil(cfg.Python, "Python field should still be nil")
	s.Nil(cfg.R, "R field should still be nil")
}

func (s *ConfigSuite) TestForceProductTypeComplianceEntrypointObjectRef() {
	// Test with Entrypoint and EntrypointObjectRef set
	cfg := &Config{
		ProductType:         ProductTypeConnect,
		Entrypoint:          "app.py",
		EntrypointObjectRef: "shiny.express.app:app_2e_py",
	}

	// Call ForceProductTypeCompliance
	cfg.ForceProductTypeCompliance()

	// Verify Entrypoint changes
	s.Equal(cfg.Entrypoint, "shiny.express.app:app_2e_py", "Entrypoint should get set from EntrypointObjectRef")
	s.Empty(cfg.EntrypointObjectRef, "EntrypointObjectRef should get cleared out")
}
