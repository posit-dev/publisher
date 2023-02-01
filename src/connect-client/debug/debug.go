package debug

import "github.com/rstudio/platform-lib/pkg/rslog"

// Copyright (C) 2023 by Posit Software, PBC.

const (
	AllRegions rslog.ProductRegion = iota
	GeneralRegion
	UIRegion
	ProxyRegion
)

var definedRegionNames = map[rslog.ProductRegion]string{
	AllRegions:    "all",
	GeneralRegion: "general",
	UIRegion:      "ui",
	ProxyRegion:   "proxy",
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

// DebugPrintRouteFunc is a gin route printer that
// prints the routes via structured logging.
func DebugPrintRouteFunc(debugLogger rslog.DebugLogger) func(string, string, string, int) {
	return func(httpMethod, absolutePath, handlerName string, _ int) {
		debugLogger.WithFields(rslog.Fields{
			"method":  httpMethod,
			"path":    absolutePath,
			"handler": handlerName,
		}).Debugf("Route defined")
	}
}
