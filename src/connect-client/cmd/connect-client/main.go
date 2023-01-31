package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/cmd/connect-client/commands"
	"connect-client/project"
	"os"

	"github.com/alecthomas/kong"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type cli struct {
	commands.CommonArgs
	commands.ServerCommands `group:"Servers"`
	Version                 commands.VersionFlag `help:"Show the client software version and exit."`
}

func main() {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)
	defer rslog.Flush()

	args := cli{
		CommonArgs: commands.CommonArgs{
			Logger: logger,
		},
	}

	ctx := kong.Parse(&args)
	args.CommonArgs.Resolve()

	args.Logger.Infof("Client version: %s", project.Version)

	// Dispatch to the Run() method of the selected command.
	err := ctx.Run(&args.CommonArgs)
	ctx.FatalIfErrorf(err)
}
