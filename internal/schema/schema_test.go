package schema

// Copyright (C) 2023 by Posit Software, PBC.
import (
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

func (s *SchemaSuite) TestValidateConfig() {
	validator, err := NewValidator[genericContent]([]string{ConfigSchemaURL})
	s.NoError(err)
	path := s.cwd.Join("schemas", "config.toml")
	_, err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDeployment() {
	validator, err := NewValidator[genericContent]([]string{DeploymentSchemaURL})
	s.NoError(err)
	path := s.cwd.Join("schemas", "record.toml")
	_, err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftConfig() {
	const draftConfigSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v4.json"
	validator, err := NewValidator[genericContent]([]string{draftConfigSchemaURL})
	s.NoError(err)
	path := s.cwd.Join("schemas", "draft", "config.toml")
	_, err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftDeployment() {
	const draftDeploymentSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-record-schema-v4.json"
	validator, err := NewValidator[genericContent]([]string{draftDeploymentSchemaURL})
	s.NoError(err)
	path := s.cwd.Join("schemas", "draft", "record.toml")
	_, err = validator.ValidateTOMLFile(path)
	s.NoError(err)
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
