package debug

import "github.com/rstudio/platform-lib/pkg/rslog"

// Copyright (C) 2023 by Posit Software, PBC.

const (
	AllRegions rslog.ProductRegion = iota
	GeneralRegion
	AccountsRegion
	UIRegion
	ProxyRegion
	ProxyHeadersRegion
)

var definedRegionNames = map[rslog.ProductRegion]string{
	AllRegions:         "all",
	GeneralRegion:      "general",
	AccountsRegion:     "accounts",
	UIRegion:           "ui",
	ProxyRegion:        "proxy",
	ProxyHeadersRegion: "proxy-headers",
}

func getRegionByName(name string) rslog.ProductRegion {
	for region, regionName := range definedRegionNames {
		if name == regionName {
			return region
		}
	}
	return GeneralRegion
}

func enableAllRegions() {
	for region := range definedRegionNames {
		rslog.Enable(region)
	}
}

func InitDebugLogging(regionNames []string) {
	rslog.RegisterRegions(definedRegionNames)
	rslog.InitDebugLogs([]rslog.ProductRegion{})

	for _, regionName := range regionNames {
		region := getRegionByName(regionName)
		rslog.Enable(region)

		if region == AllRegions {
			enableAllRegions()
		}
	}
}
