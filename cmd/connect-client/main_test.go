package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util/utiltest"
)

type MainSuite struct {
	utiltest.Suite
}

func TestMainSuite(t *testing.T) {
	suite.Run(t, new(MainSuite))
}

func (s *MainSuite) TestMakeContext() {
	log := logging.New()
	ctx, err := makeContext(log)
	s.Nil(err)
	s.NotNil(ctx.Accounts)
	s.Equal(log, ctx.Logger)
}
