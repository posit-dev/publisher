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

	Publish commands.PublishCmd  `cmd:"" help:"Publish a project."`
	Version commands.VersionFlag `help:"Show the client software version and exit."`
}

func main() {
	defer rslog.Flush()

	cli := cliSpec{
		CommonArgs: commands.CommonArgs{},
	}

	args := kong.Parse(&cli)
	cli.CommonArgs.Resolve()

	ctx, err := commands.NewCLIContext()
	if err != nil {
		ctx.Logger.Fatalf("Error initializing client: %s", err)
	}
	ctx.Logger.Infof("Client version: %s", project.Version)

	// Dispatch to the Run() method of the selected command.
	args.Bind(ctx)
	err = args.Run(&cli.CommonArgs)
	args.FatalIfErrorf(err)
}
