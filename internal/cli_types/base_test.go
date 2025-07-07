package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type CLIContextSuite struct {
	utiltest.Suite
}

func TestCLIContextSuite(t *testing.T) {
	suite.Run(t, new(CLIContextSuite))
}

func (s *CLIContextSuite) TestNewCLIContext() {
	fs := utiltest.NewMockFs()
	log := logging.New()

	ctx := NewCLIContext(fs, log)
	s.Equal(log, ctx.Logger)
}
