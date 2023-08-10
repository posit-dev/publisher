package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"
)

type CLIContextSuite struct {
	utiltest.Suite
}

func TestCLIContextSuite(t *testing.T) {
	suite.Run(t, new(CLIContextSuite))
}

func (s *CLIContextSuite) TestNewCLIContext() {
	accountList := &accounts.MockAccountList{}
	token := services.LocalToken("abc123")
	fs := utiltest.NewMockFs()
	logger := rslog.NewDiscardingLogger()

	ctx := NewCLIContext(accountList, token, fs, logger)
	s.Equal(accountList, ctx.Accounts)
	s.Equal(token, ctx.LocalToken)
	s.Equal(logger, ctx.Logger)
	accountList.AssertNotCalled(s.T(), "GetAllAccounts")
}
