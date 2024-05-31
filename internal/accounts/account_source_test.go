package accounts

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type AccountSourceSuite struct {
	utiltest.Suite
}

func TestAccountSourceSuite(t *testing.T) {
	suite.Run(t, new(AccountSourceSuite))
}

func (s *AccountSourceSuite) TestDescription() {
	s.Equal("rsconnect-python", AccountSourceRsconnectPython.Description())
	s.Equal("RStudio IDE/rsconnect", AccountSourceRsconnect.Description())
	s.Equal("CONNECT_SERVER environment variable", AccountSourceEnvironment.Description())
	s.Equal("hey", AccountSource("hey").Description())
}
