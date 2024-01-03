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
	s.Equal("Posit Connect", ServerTypeConnect.Description())
	s.Equal("shinyapps.io", ServerTypeShinyappsIO.Description())
	s.Equal("Posit Cloud", ServerTypeCloud.Description())
	s.Equal("hey", ServerType("hey").Description())
}

func (s *AccountTypeSuite) TestAccountTypeFromURL() {
	s.Equal(ServerTypeShinyappsIO, serverTypeFromURL("https://api.shinyapps.io"))
	s.Equal(ServerTypeShinyappsIO, serverTypeFromURL("https://api.staging.shinyapps.io"))
	s.Equal(ServerTypeCloud, serverTypeFromURL("https://api.posit.cloud"))
	s.Equal(ServerTypeCloud, serverTypeFromURL("https://api.rstudio.cloud"))
	s.Equal(ServerTypeConnect, serverTypeFromURL("https://example.com"))
}
