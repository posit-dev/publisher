package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type RandomSuite struct {
	utiltest.Suite
}

func TestRandomSuite(t *testing.T) {
	suite.Run(t, new(RandomSuite))
}

func (s *RandomSuite) TestRandomBytes() {
	r1, err := RandomBytes(32)
	s.NoError(err)
	s.Len(r1, 32)

	r2, err := RandomBytes(32)
	s.NoError(err)
	s.Len(r2, 32)
	s.NotEqual(r1, r2)

	r3, err := RandomBytes(12)
	s.NoError(err)
	s.Len(r3, 12)
}

func (s *RandomSuite) TestRandomString() {
	r1, err := RandomString(32)
	s.NoError(err)
	s.Len(r1, 32)

	r2, err := RandomString(32)
	s.NoError(err)
	s.Len(r2, 32)
	s.NotEqual(r1, r2)

	r3, err := RandomString(12)
	s.NoError(err)
	s.Len(r3, 12)
}
