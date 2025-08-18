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

type fileValidationTestCase struct {
	schemaURL string
	dataFile  []string
}

func (s *SchemaSuite) TestValidateFile() {
	cases := []fileValidationTestCase{
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
			schemaURL: DeploymentSchemaURL,
			dataFile:  []string{"record_cloud.toml"},
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

type dataValidationTestCase struct {
	title string
	data  map[string]any
}

func (s *SchemaSuite) TestValidateConfig() {
	cases := []dataValidationTestCase{
		{
			title: "connect config without product_type",
			data: map[string]any{
				"$schema":    ConfigSchemaURL,
				"type":       "python-dash",
				"entrypoint": "app.py",
				"python": map[string]any{
					"requires_python": ">=3.8",
				},
				"connect": map[string]any{},
			},
		},
		{
			title: "connect config with product_type",
			data: map[string]any{
				"$schema":      ConfigSchemaURL,
				"product_type": "connect",
				"type":         "python-dash",
				"entrypoint":   "app.py",
				"python": map[string]any{
					"requires_python": ">=3.8",
				},
				"connect": map[string]any{},
			},
		},
		{
			title: "connect cloud config with product_type",
			data: map[string]any{
				"$schema":      ConfigSchemaURL,
				"product_type": "connect_cloud",
				"type":         "python-dash",
				"entrypoint":   "app.py",
				"python": map[string]any{
					"version": "3.8",
				},
				"connect_cloud": map[string]any{},
			},
		},
	}

	for _, testCase := range cases {
		s.Run(testCase.title, func() {
			validator, err := NewValidator[genericContent](ConfigSchemaURL)
			s.NoError(err)
			err = validator.ValidateContent(testCase.data)
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
	productType string
	basePath    []string
	propName    string
	propValue   any

	message string
}

func (s *SchemaSuite) TestDisallowedProperties() {
	cases := []invalidPropertyTestCase{
		// Root level invalid properties
		{
			productType: "connect",
			basePath:    []string{},
			propName:    "garbage",
			propValue:   "value",
			message:     "garbage: not allowed.",
		},

		// Connect product_type invalid properties
		{
			productType: "connect",
			basePath:    []string{"python"},
			propName:    "garbage",
			propValue:   "value",
			message:     "python: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"r"},
			propName:    "garbage",
			propValue:   "value",
			message:     "r: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"jupyter"},
			propName:    "garbage",
			propValue:   "value",
			message:     "jupyter: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"quarto"},
			propName:    "garbage",
			propValue:   "value",
			message:     "quarto: missing properties: 'version'; quarto: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"connect"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"connect", "runtime"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect.runtime: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"connect", "kubernetes"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect.kubernetes: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect",
			basePath:    []string{"connect", "access"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect.access: additionalProperties 'garbage' not allowed.",
		},

		// Connect Cloud product_type invalid properties
		{
			productType: "connect_cloud",
			basePath:    []string{"python"},
			propName:    "garbage",
			propValue:   "value",
			message:     "python: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"python"},
			propName:    "requires_python",
			propValue:   ">=3.8",
			message:     "python: additionalProperties 'requires_python' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"python"},
			propName:    "package_file",
			propValue:   "requirements.txt",
			message:     "python: additionalProperties 'package_file' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"python"},
			propName:    "package_manager",
			propValue:   "pip",
			message:     "python: additionalProperties 'package_manager' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"r"},
			propName:    "garbage",
			propValue:   "value",
			message:     "r: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"r"},
			propName:    "requires_r",
			propValue:   ">=4.2",
			message:     "r: additionalProperties 'requires_r' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"r"},
			propName:    "package_file",
			propValue:   "renv.lock",
			message:     "r: additionalProperties 'package_file' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"r"},
			propName:    "package_manager",
			propValue:   "renv",
			message:     "r: additionalProperties 'package_manager' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"connect_cloud"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect_cloud: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"connect_cloud", "python"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect_cloud.python: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"connect_cloud", "r"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect_cloud.r: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{"connect_cloud", "access_control"},
			propName:    "garbage",
			propValue:   "value",
			message:     "connect_cloud.access_control: additionalProperties 'garbage' not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{},
			propName:    "jupyter",
			propValue:   map[string]any{},
			message:     "jupyter: not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{},
			propName:    "quarto",
			propValue:   map[string]any{},
			message:     "quarto: not allowed.",
		},
		{
			productType: "connect_cloud",
			basePath:    []string{},
			propName:    "has_parameters",
			propValue:   true,
			message:     "has_parameters: not allowed.",
		},

		// Connect properties shouldn't be allowed with connect_cloud product_type
		{
			productType: "connect_cloud",
			basePath:    []string{},
			propName:    "connect",
			propValue:   map[string]any{},
			message:     "connect: not allowed.",
		},

		// Connect_cloud properties shouldn't be allowed with connect product_type
		{
			productType: "connect",
			basePath:    []string{},
			propName:    "connect_cloud",
			propValue:   map[string]any{},
			message:     "connect_cloud: not allowed.",
		},
	}

	for _, tc := range cases {
		propPath := append(tc.basePath, tc.propName)
		description := fmt.Sprintf("%s:  .%s=%s", tc.productType, strings.Join(propPath, "."), tc.propValue)
		s.Run(description, func() {
			// Set up the validator
			validator, err := NewValidator[genericContent](ConfigSchemaURL)
			s.NoError(err)

			// Create a valid base configuration map
			baseConfig := map[string]any{
				"$schema":      ConfigSchemaURL,
				"product_type": tc.productType,
				"type":         "html",
				"entrypoint":   "index.html",
			}

			// Ensure it's valid
			err = validator.ValidateContent(baseConfig)
			s.NoError(err, "Base config should be valid before adding invalid property")

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

			// Validate and expect an error
			err = validator.ValidateContent(baseConfig)
			s.Error(err, "Expected validation error")

			// Check that it's a schema validation error
			agentErr, ok := err.(*types.AgentError)
			s.True(ok)
			s.Equal(tomlValidationErrorCode, agentErr.Code)
			s.Equal(tc.message, agentErr.Message)
		})
	}
}
