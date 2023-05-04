package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

// Copyright (C) 2023 by Posit Software, PBC.

type SliceSuite struct {
	utiltest.Suite
}

func TestSliceSuite(t *testing.T) {
	suite.Run(t, new(SliceSuite))
}

func (s *SliceSuite) TestRemoveDuplicatesString() {
	orig := []string{"abc", "def", "abc", "efg"}
	dedup := RemoveDuplicates(orig)
	expected := []string{"abc", "def", "efg"}
	s.Equal(expected, dedup)
}

func (s *SliceSuite) TestRemoveDuplicatesNoDups() {
	orig := []string{"abc", "def", "ghi"}
	dedup := RemoveDuplicates(orig)
	s.Equal(orig, dedup)
}

func (s *SliceSuite) TestRemoveDuplicatesInt() {
	orig := []int{0, 1, 1, 2, 3, 4, 2}
	dedup := RemoveDuplicates(orig)
	expected := []int{0, 1, 2, 3, 4}
	s.Equal(expected, dedup)
}
