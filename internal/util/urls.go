package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

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
