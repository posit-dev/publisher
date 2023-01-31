package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/cmd/connect-client/commands"
	"connect-client/project"

	"github.com/alecthomas/kong"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type cliSpec struct {
	commands.CommonArgs
	commands.ServerCommands `group:"Servers"`
	Version                 commands.VersionFlag `help:"Show the client software version and exit."`
}

func main() {
	ctx := commands.NewCLIContext()
	ctx.Logger.Infof("Client version: %s", project.Version)
	defer rslog.Flush()

	cli := cliSpec{
		CommonArgs: commands.CommonArgs{},
	}

	args := kong.Parse(&cli)
	cli.CommonArgs.Resolve()
	args.Bind(ctx)

	// Dispatch to the Run() method of the selected command.
	err := args.Run(&cli.CommonArgs)
	args.FatalIfErrorf(err)
}
