package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/stretchr/testify/suite"

	"github.com/rstudio/connect-client/internal/util/utiltest"
)

type MainSuite struct {
	utiltest.Suite
}

func TestMainSuite(t *testing.T) {
	suite.Run(t, new(MainSuite))
}

func (s *MainSuite) TestMakeContext() {
	logger := rslog.NewDiscardingLogger()
	ctx, err := makeContext(logger)
	s.Nil(err)
	s.NotNil(ctx.Accounts)
	s.NotEqual(ctx.LocalToken, "")
	s.Equal(logger, ctx.Logger)
}
