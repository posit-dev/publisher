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
	validator, err := NewValidator(ConfigSchemaURL)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "deploy.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}

func (s *SchemaSuite) TestValidateDeployment() {
	validator, err := NewValidator(DeploymentSchemaURL)
	s.NoError(err)
	path := util.NewPath(".", nil).Join("schemas", "record.toml")
	err = validator.ValidateTOMLFile(path)
	s.NoError(err)
}
