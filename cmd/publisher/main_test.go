package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type MainSuite struct {
	utiltest.Suite
}

func TestMainSuite(t *testing.T) {
	suite.Run(t, new(MainSuite))
}

func (s *MainSuite) TestVersion() {
	os.Args = []string{"publisher", "version"}
	main()
}
