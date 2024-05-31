package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type ConnectContentSuite struct {
	utiltest.Suite
}

func TestConnectContentSuite(t *testing.T) {
	suite.Run(t, new(ConnectContentSuite))
}
