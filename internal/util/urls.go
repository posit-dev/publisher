package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/PuerkitoBio/purell"
	"github.com/posit-dev/publisher/internal/types"
)

func NormalizeServerURL(serverURL string) (string, error) {
	flags := (purell.FlagsSafe |
		purell.FlagRemoveTrailingSlash |
		purell.FlagRemoveDotSegments |
		purell.FlagRemoveDuplicateSlashes)
	return purell.NormalizeURLString(serverURL, flags)
}

func GetDashboardURL(accountURL string, contentID types.ContentID) string {
	return fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID)
}

func GetLogsURL(accountURL string, contentID types.ContentID) string {
	return GetDashboardURL(accountURL, contentID) + "/logs"
}

func GetDirectURL(accountURL string, contentID types.ContentID) string {
	return fmt.Sprintf("%s/content/%s/", accountURL, contentID)
}

func GetBundleURL(accountURL string, contentID types.ContentID, bundleID types.BundleID) string {
	return fmt.Sprintf("%s/__api__/v1/content/%s/bundles/%s/download", accountURL, contentID, bundleID)
}

// Returns an array of URLs built from no path, to a path with a full path, one URL for each
// path segment

func GetListOfPossibleURLs(accountURL string) ([]string, error) {
	urlStr, err := NormalizeServerURL(accountURL)
	if err != nil {
		return nil, err
	}
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	// clear out query and Fragment (we don't want them)
	u.RawQuery = ""
	u.Fragment = ""

	// break out path into segments
	parts := strings.Split(u.Path, "/")

	urls := []string{}
	// start with no path
	u.Path = ""

	// now build a list
	// even an URL without a path will include a ""
	for _, p := range parts {
		u.Path = path.Join(u.Path, p)
		urls = append(urls, u.String())
	}

	return urls, nil
}

// URLTester is a function type that tests if a URL is valid/accessible
// Returns nil if the URL is valid, or an error if not
type URLTester func(url string) error

// DiscoverServerURL attempts to find the correct server URL by testing
// a list of possible URLs derived from the provided URL.
// It walks the possible URL list backwards, prioritizing the full URL 
// with all path segments over the URL with all path segments removed.
// Returns the first URL that passes the test, or the original URL if none pass.
func DiscoverServerURL(providedURL string, tester URLTester) (string, error) {
	// Create a list of URLs to attempt
	possibleURLs, err := GetListOfPossibleURLs(providedURL)
	if err != nil {
		return providedURL, err
	}

	var lastTestError error

	// Walk the possible URL list backwards
	// This prioritizes the full URL with all path segments over
	// the URL with all path segments removed.
	for i := len(possibleURLs) - 1; i >= 0; i-- {
		urlToTest := possibleURLs[i]
		
		testErr := tester(urlToTest)
		if testErr == nil {
			// Success! Return the working URL
			return urlToTest, nil
		}
		lastTestError = testErr
	}

	// If no URL worked, return the original URL and the last error
	return providedURL, lastTestError
}
