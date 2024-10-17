package util

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type UrlsSuite struct {
	utiltest.Suite
}

func TestUrlsSuite(t *testing.T) {
	suite.Run(t, new(UrlsSuite))
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

func (u *UrlsSuite) TestGetListOfPossibleURLs() {

	// invalid URL
	_, err := GetListOfPossibleURLs(" http://example.org")
	u.NotNil(err)

	// no paths included, should have one
	expected := "https://connect.dev.com"
	l, err := GetListOfPossibleURLs(expected)
	u.Nil(err)
	u.Equal(len(l), 1)
	u.Equal(l[0], expected)

	// strip query off of URL
	url := "https://connect.dev.com?a=b"
	expected = "https://connect.dev.com"
	l, err = GetListOfPossibleURLs(url)
	u.Nil(err)
	u.Equal(len(l), 1)
	u.Equal(l[0], expected)

	// list of paths
	url = "https://connect.dev.com/a/b/c/d/e"
	results := []string{
		"https://connect.dev.com",
		"https://connect.dev.com/a",
		"https://connect.dev.com/a/b",
		"https://connect.dev.com/a/b/c",
		"https://connect.dev.com/a/b/c/d",
		"https://connect.dev.com/a/b/c/d/e",
	}
	l, err = GetListOfPossibleURLs(url)
	u.Nil(err)
	u.Equal(len(l), 6)
	u.Equal(l, results)

	// list of paths with duplicate forward slashes
	url = "https://connect.dev.com//a/b/c/d/e//////"
	results = []string{
		"https://connect.dev.com",
		"https://connect.dev.com/a",
		"https://connect.dev.com/a/b",
		"https://connect.dev.com/a/b/c",
		"https://connect.dev.com/a/b/c/d",
		"https://connect.dev.com/a/b/c/d/e",
	}
	l, err = GetListOfPossibleURLs(url)
	u.Nil(err)
	u.Equal(len(l), 6)
	u.Equal(l, results)

}
