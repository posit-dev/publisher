package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AccountAuthTypeSuite struct {
	utiltest.Suite
}

func TestAccountAuthTypeSuite(t *testing.T) {
	suite.Run(t, new(AccountAuthTypeSuite))
}

func (s *AccountAuthTypeSuite) TestDescription() {
	s.Equal("No saved credentials", AuthTypeNone.Description())
	s.Equal("Connect API key", AuthTypeAPIKey.Description())
	s.Equal("RStudio IDE/rsconnect token+key", AuthTypeTokenKey.Description())
	s.Equal("RStudio IDE/rsconnect token+secret", AuthTypeTokenSecret.Description())
	s.Equal("hey", AccountAuthType("hey").Description())
}
