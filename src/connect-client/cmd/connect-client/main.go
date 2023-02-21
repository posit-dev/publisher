package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/cmd/connect-client/commands"
	"connect-client/project"
	"fmt"
	"os"

	"github.com/alecthomas/kong"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type cliSpec struct {
	commands.CommonArgs
	commands.AccountCommands `group:"Accounts"`

	Publish commands.PublishCmd  `cmd:"" help:"Publish a project."`
	Version commands.VersionFlag `help:"Show the client software version and exit."`
}

func logVersion(logger rslog.Logger) {
	logger.WithFields(rslog.Fields{
		"version": project.Version,
	}).Infof("Client version")
}

func main() {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)
	logVersion(logger)

	defer rslog.Flush()
	ctx, err := commands.NewCLIContext(logger)
	if err != nil {
		logger.Fatalf("Error initializing client: %s", err)
	}

	cli := cliSpec{
		CommonArgs: commands.CommonArgs{},
	}

	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	err = args.Run(&cli.CommonArgs)
	if err != nil {
		logger.Errorf("%s", err)
		fmt.Println(err)
		os.Exit(1)
	}
}
