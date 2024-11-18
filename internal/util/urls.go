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
