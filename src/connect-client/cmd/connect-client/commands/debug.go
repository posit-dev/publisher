package commands

import (
	"github.com/rstudio/platform-lib/pkg/rslog"
)

const (
	GeneralRegion rslog.ProductRegion = 1
)

func initDebugLogging(enabled bool) {
	rslog.RegisterRegions(map[rslog.ProductRegion]string{
		GeneralRegion: "general",
	})
	if enabled {
		rslog.InitDebugLogs([]rslog.ProductRegion{
			GeneralRegion,
		})
	}
}

type debugFlag bool

func (d debugFlag) AfterApply() error {
	initDebugLogging(bool(d))
	return nil
}
