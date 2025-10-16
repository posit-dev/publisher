package util

// Copyright (C) 2023 by Posit Software, PBC.
import (
	"errors"
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

func (u *UrlsSuite) TestDiscoverServerURL() {
	// Test successful discovery - returns first working URL
	tester := func(url string) error {
		if url == "https://connect.dev.com/server" {
			return nil
		}
		return errors.New("not found")
	}
	
	discovered, err := DiscoverServerURL("https://connect.dev.com/server/connect/#/apps", tester)
	u.Nil(err)
	u.Equal("https://connect.dev.com/server", discovered)

	// Test when no URL works - returns original URL and error
	testerAlwaysFails := func(url string) error {
		return errors.New("always fails")
	}
	
	discovered, err = DiscoverServerURL("https://connect.dev.com/path", testerAlwaysFails)
	u.NotNil(err)
	u.Equal("https://connect.dev.com/path", discovered)
	u.Equal("always fails", err.Error())

	// Test when base URL works (no path)
	testerBaseOnly := func(url string) error {
		if url == "https://connect.dev.com" {
			return nil
		}
		return errors.New("not base")
	}
	
	discovered, err = DiscoverServerURL("https://connect.dev.com/connect/#/welcome", testerBaseOnly)
	u.Nil(err)
	u.Equal("https://connect.dev.com", discovered)

	// Test priority - full URL tested before stripped versions
	callOrder := []string{}
	testerTracking := func(url string) error {
		callOrder = append(callOrder, url)
		if url == "https://connect.dev.com/a" {
			return nil
		}
		return errors.New("not found")
	}
	
	discovered, err = DiscoverServerURL("https://connect.dev.com/a/b/c", testerTracking)
	u.Nil(err)
	u.Equal("https://connect.dev.com/a", discovered)
	// Verify it tested in reverse order (full path first)
	u.Equal([]string{
		"https://connect.dev.com/a/b/c",
		"https://connect.dev.com/a/b",
		"https://connect.dev.com/a",
	}, callOrder)

	// Test with invalid URL
	discovered, err = DiscoverServerURL(" http://invalid url", tester)
	u.NotNil(err)
	u.Equal(" http://invalid url", discovered)
}
