package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/PuerkitoBio/purell"
)

func NormalizeServerURL(serverURL string) (string, error) {
	flags := (purell.FlagsSafe |
		purell.FlagRemoveTrailingSlash |
		purell.FlagRemoveDotSegments |
		purell.FlagRemoveDuplicateSlashes)
	return purell.NormalizeURLString(serverURL, flags)
}
