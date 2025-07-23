package schema

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"strings"
	"testing"

	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
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
			schemaURL: "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v4.json",
			dataFile:  []string{"draft", "config.toml"},
		},
		{
			schemaURL: "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v4.json",
			dataFile:  []string{"draft", "config_cloud.toml"},
		},
		{
			schemaURL: DeploymentSchemaURL,
			dataFile:  []string{"record.toml"},
		},
		{
			schemaURL: "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-record-schema-v4.json",
			dataFile:  []string{"draft", "record.toml"},
		},
	}

	for _, testCase := range cases {
		s.Run(strings.Join(testCase.dataFile, "/"), func() {
			validator, err := NewValidator[genericContent]([]string{testCase.schemaURL})
			s.NoError(err)
			schemaPath := append([]string{"schemas"}, testCase.dataFile...)
			path := s.cwd.Join(schemaPath...)
			_, err = validator.ValidateTOMLFile(path)
			s.NoError(err)
		})
	}
}

func (s *SchemaSuite) TestValidationError() {
	cwd, err := util.Getwd(afero.NewMemMapFs())
	s.NoError(err)
	err = cwd.MkdirAll(0700)
	s.NoError(err)

	badTOML := []byte("\"$schema\" = \"https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v4.json\"\nbad-attr = 1\n")
	path := cwd.Join("test.toml")
	err = path.WriteFile(badTOML, 0600)
	s.NoError(err)

	validator, err := NewValidator[genericContent]([]string{ConfigSchemaURL})
	s.NoError(err)
	_, err = validator.ValidateTOMLFile(path)
	agentErr, ok := err.(*types.AgentError)
	s.True(ok)
	s.Equal(agentErr.Code, tomlValidationErrorCode)
}
