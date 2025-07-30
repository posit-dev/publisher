package schema

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"fmt"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type SchemaSuite struct {
	utiltest.Suite
	cwd util.AbsolutePath
}

func TestSchemaSuite(t *testing.T) {
	suite.Run(t, new(SchemaSuite))
}

func (s *SchemaSuite) SetupTest() {
	cwd, err := util.Getwd(nil)
	s.NoError(err)
	s.cwd = cwd
}

type genericContent map[string]any

type validationTestCase struct {
	schemaURL string
	dataFile  []string
}

func (s *SchemaSuite) TestValidateConfig() {
	cases := []validationTestCase{
		{
			schemaURL: ConfigSchemaURL,
			dataFile:  []string{"config.toml"},
		},
		{
			schemaURL: ConfigSchemaURL,
			dataFile:  []string{"config_cloud.toml"},
		},
		{
			schemaURL: "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v3.json",
			dataFile:  []string{"draft", "config_cloud.toml"},
		},
		{
			schemaURL: DeploymentSchemaURL,
			dataFile:  []string{"record.toml"},
		},
		{
			schemaURL: "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-record-schema-v3.json",
			dataFile:  []string{"draft", "record.toml"},
		},
	}

	for _, testCase := range cases {
		s.Run(strings.Join(testCase.dataFile, "/"), func() {
			validator, err := NewValidator[genericContent](testCase.schemaURL)
			s.NoError(err)
			schemaPath := append([]string{"schemas"}, testCase.dataFile...)
			path := s.cwd.Join(schemaPath...)
			err = validator.ValidateTOMLFile(path)
			s.NoError(err)
		})
	}
}

func (s *SchemaSuite) TestValidationError() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	err = cwd.MkdirAll(0700)
	s.NoError(err)

	badTOML := []byte("bad-attr = 1\n")
	path := cwd.Join("test.toml")
	err = path.WriteFile(badTOML, 0600)
	s.NoError(err)

	validator, err := NewValidator[genericContent](ConfigSchemaURL)
	s.NoError(err)
	err = validator.ValidateTOMLFile(path)
	agentErr, ok := err.(*types.AgentError)
	s.True(ok)
	s.Equal(agentErr.Code, tomlValidationErrorCode)
}

type invalidPropertyTestCase struct {
	serverType string
	basePath   []string
	propName   string
	propValue  any
}

func (s *SchemaSuite) TestDisallowedProperties() {
	cases := []invalidPropertyTestCase{
		// Root level invalid properties
		{
			serverType: "connect",
			basePath:   []string{},
			propName:   "garbage",
			propValue:  "value",
		},

		// Connect server_type invalid properties
		{
			serverType: "connect",
			basePath:   []string{"python"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"r"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"jupyter"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"quarto"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"connect"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"connect", "runtime"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"connect", "kubernetes"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect",
			basePath:   []string{"connect", "access"},
			propName:   "garbage",
			propValue:  "value",
		},

		// Connect Cloud server_type invalid properties
		{
			serverType: "connect_cloud",
			basePath:   []string{"python"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"python"},
			propName:   "requires_python",
			propValue:  ">=3.8",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"python"},
			propName:   "package_file",
			propValue:  "requirements.txt",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"python"},
			propName:   "package_manager",
			propValue:  "pip",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"r"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"r"},
			propName:   "requires_r",
			propValue:  ">=4.2",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"r"},
			propName:   "package_file",
			propValue:  "renv.lock",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"r"},
			propName:   "package_manager",
			propValue:  "renv",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"connect_cloud"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"connect_cloud", "python"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"connect_cloud", "r"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{"connect_cloud", "access_control"},
			propName:   "garbage",
			propValue:  "value",
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{},
			propName:   "jupyter",
			propValue:  map[string]any{},
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{},
			propName:   "quarto",
			propValue:  map[string]any{},
		},
		{
			serverType: "connect_cloud",
			basePath:   []string{},
			propName:   "has_parameters",
			propValue:  true,
		},

		// Connect properties shouldn't be allowed with connect_cloud server_type
		{
			serverType: "connect_cloud",
			basePath:   []string{},
			propName:   "connect",
			propValue:  map[string]any{},
		},

		// Connect_cloud properties shouldn't be allowed with connect server_type
		{
			serverType: "connect",
			basePath:   []string{},
			propName:   "connect_cloud",
			propValue:  map[string]any{},
		},
	}

	for _, tc := range cases {
		propPath := append(tc.basePath, tc.propName)
		description := fmt.Sprintf("%s:  .%s=%s", tc.serverType, strings.Join(propPath, "."), tc.propValue)
		s.Run(description, func() {
			// Create a valid base configuration map
			baseConfig := map[string]any{
				"$schema":     "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json",
				"server_type": tc.serverType,
				"type":        "python-shiny",
				"entrypoint":  "foo.py",
			}

			// Acquire the nested structure
			target := baseConfig
			for _, path := range tc.basePath {
				if _, exists := target[path]; !exists {
					target[path] = map[string]any{}
				}
				target = target[path].(map[string]any)
			}

			// Add the invalid property
			target[tc.propName] = tc.propValue

			// Set up the validator
			validator, err := NewValidator[genericContent](ConfigSchemaURL)
			s.NoError(err)

			// Validate and expect an error
			err = validator.ValidateContent(baseConfig)
			s.Error(err, "Expected validation error for case: %s", description)

			// Check that it's a schema validation error
			agentErr, ok := err.(*types.AgentError)
			s.True(ok)
			s.Equal(agentErr.Code, tomlValidationErrorCode)
		})
	}
}
