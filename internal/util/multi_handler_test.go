package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type MultiHandlerSuite struct {
	utiltest.Suite
}

func TestMultiHanlderSuite(t *testing.T) {
	suite.Run(t, new(MultiHandlerSuite))
}
