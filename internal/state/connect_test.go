package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ConnectStateSuite struct {
	utiltest.Suite
}

func TestConnectStateSuite(t *testing.T) {
	suite.Run(t, new(ConnectStateSuite))
}
