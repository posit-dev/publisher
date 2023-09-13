package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type RandomSuite struct {
	utiltest.Suite
}

func TestRandomSuite(t *testing.T) {
	suite.Run(t, new(RandomSuite))
}

func (s *RandomSuite) TestRandomBytes() {
	r, err := RandomBytes(32)
	s.Nil(err)
	s.Len(r, 32)
}
