package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type LoggingSuite struct {
	utiltest.Suite
}

func TestLoggingSuite(t *testing.T) {
	suite.Run(t, new(LoggingSuite))
}
