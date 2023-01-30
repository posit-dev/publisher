package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/project"
	"fmt"
	"os"

	"github.com/alecthomas/kong"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type versionCmd struct{}

func (cmd *versionCmd) Run(ctx *commonArgs) error {
	fmt.Println(project.Version)
	return nil
}

type commonArgs struct {
	Debug       bool       `help:"Enable debug mode."`
	Serve       bool       `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool       `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Version     versionCmd `cmd:"" help:"Show the client software version."`
	logger      rslog.Logger
	debugLogger rslog.DebugLogger
}

func (args *commonArgs) resolve() {
	if args.Interactive {
		args.Serve = true
	}
	initDebugLogging(args.Debug)
	args.debugLogger = rslog.NewDebugLogger(GeneralRegion)
}

type cliArgs struct {
	commonArgs
	serverCommands `group:"Servers"`
}

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

func main() {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)
	defer rslog.Flush()

	args := cliArgs{
		commonArgs: commonArgs{
			logger: logger,
		},
	}

	ctx := kong.Parse(&args)
	args.commonArgs.resolve()

	// Dispatch to the Run() method of the selected command.
	err := ctx.Run(&args.commonArgs)
	ctx.FatalIfErrorf(err)
}
