package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type PublishCommandSuite struct {
	utiltest.Suite
}

func TestPublishCommandSuite(t *testing.T) {
	suite.Run(t, new(PublishCommandSuite))
}
