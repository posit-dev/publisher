package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type HTTPSuite struct {
	utiltest.Suite
}

func TestHTTPSuite(t *testing.T) {
	suite.Run(t, new(HTTPSuite))
}

func (s *HTTPSuite) TestURLJoin() {
	s.Equal("a/b", URLJoin("a", "b"))
	s.Equal("a/b", URLJoin("a/", "b"))
	s.Equal("a/b", URLJoin("a", "/b"))
	s.Equal("a/b", URLJoin("a/", "/b"))

	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a", "b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a/", "b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a", "/b"))
	s.Equal("https://example.com/a/b", URLJoin("https://example.com/a/", "/b"))
}
