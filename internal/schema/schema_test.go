package schema

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"testing"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type SchemaSuite struct {
	utiltest.Suite
}

func TestSchemaSuite(t *testing.T) {
	suite.Run(t, new(SchemaSuite))
}

func (s *SchemaSuite) TestValidateConfig() {
	var content map[string]any
	validator, err := NewValidator(ConfigSchemaURL, &content)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "deploy.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDeployment() {
	var content map[string]any
	validator, err := NewValidator(DeploymentSchemaURL, &content)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "record.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftConfig() {
	const draftConfigSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-schema-v3.json"
	var content map[string]any
	validator, err := NewValidator(draftConfigSchemaURL, &content)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "draft", "deploy.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDraftDeployment() {
	const draftDeploymentSchemaURL = "https://cdn.posit.co/publisher/schemas/draft/posit-publishing-record-schema-v3.json"
	var content map[string]any
	validator, err := NewValidator(draftDeploymentSchemaURL, &content)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "draft", "record.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}
