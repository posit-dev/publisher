package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AccountTypeSuite struct {
	utiltest.Suite
}

func TestAccountTypeSuite(t *testing.T) {
	suite.Run(t, new(AccountTypeSuite))
}

func (s *AccountTypeSuite) TestDescription() {
	s.Equal("Posit Connect", AccountTypeConnect.Description())
	s.Equal("shinyapps.io", AccountTypeShinyappsIO.Description())
	s.Equal("Posit Cloud", AccountTypeCloud.Description())
	s.Equal("hey", AccountType("hey").Description())
}

func (s *AccountTypeSuite) TestAccountTypeFromURL() {
	s.Equal(AccountTypeShinyappsIO, accountTypeFromURL("https://api.shinyapps.io"))
	s.Equal(AccountTypeCloud, accountTypeFromURL("https://api.posit.cloud"))
	s.Equal(AccountTypeCloud, accountTypeFromURL("https://api.rstudio.cloud"))
	s.Equal(AccountTypeConnect, accountTypeFromURL("https://example.com"))
}
