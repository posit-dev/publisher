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
	validator, err := NewValidator[genericContent](ConfigSchemaURL)
	s.NoError(err)
	path := s.cwd.Join("schemas", "config.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDeployment() {
	validator, err := NewValidator[genericContent](DeploymentSchemaURL)
	s.NoError(err)
	path := s.cwd.Join("schemas", "record.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftConfig() {
	const draftConfigSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v3.json"
	validator, err := NewValidator[genericContent](draftConfigSchemaURL)
	s.NoError(err)
	path := s.cwd.Join("schemas", "draft", "config.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftDeployment() {
	const draftDeploymentSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-record-schema-v3.json"
	validator, err := NewValidator[genericContent](draftDeploymentSchemaURL)
	s.NoError(err)
	path := s.cwd.Join("schemas", "draft", "record.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
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
