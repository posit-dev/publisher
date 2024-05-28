package util

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type UrlsSuite struct {
	utiltest.Suite
}

func TestUrlsSuite(t *testing.T) {
	suite.Run(t, new(TOMLSuite))
}

func (u *UrlsSuite) normalizedUrlEquals(expected string, url string) {
	normalized, err := NormalizeServerURL(url)
	u.NoError(err)
	u.Equal(expected, normalized)
}

func (s *UrlsSuite) TestNormalizeServerURL() {
	s.normalizedUrlEquals("http://connect.example.com", "http://connect.example.com")
	s.normalizedUrlEquals("https://connect.example.com", "https://connect.example.com")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com/rsc")

	s.normalizedUrlEquals("https://connect.example.com", "https://CONNECT.example.com")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com:443/rsc")
	s.normalizedUrlEquals("https://connect.example.com/rsc", "https://connect.example.com///rsc/")
}
