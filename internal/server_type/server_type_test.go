package server_type

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
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
	s.Equal("Posit Connect Cloud", ServerTypeConnectCloud.Description())
	s.Equal("hey", ServerType("hey").Description())
}

func (s *AccountTypeSuite) TestAccountTypeFromURL() {
	for _, test := range []struct {
		url        string
		serverType ServerType
	}{
		{"https://api.staging.connect.posit.cloud", ServerTypeConnectCloud},
		{"https://api.connect.posit.cloud", ServerTypeConnectCloud},
		{"https://example.com", ServerTypeConnect},
		{"https://example.com/connect/#/content", ServerTypeConnect},
		{"https://example.snowflakecomputing.app", ServerTypeSnowflake},
		{"https://example.snowflakecomputing.app/connect/#/content", ServerTypeSnowflake},
		{"https://example.privatelink.snowflake.app", ServerTypeSnowflake},
		{"https://example.privatelink.snowflake.app/connect/#/content", ServerTypeSnowflake},
	} {
		serverType, err := ServerTypeFromURL(test.url)
		s.Nil(err)
		s.Equal(test.serverType, serverType)
	}

	_, err := ServerTypeFromURL(":bad")
	s.NotNil(err)
}
