package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"runtime/pprof"
	"strings"

	"github.com/alecthomas/kong"
	"github.com/rstudio/connect-client/cmd/publisher/commands"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/spf13/afero"
)

type cliSpec struct {
	cli_types.CommonArgs
	commands.AccountCommands `group:"Accounts"`

	Init     commands.InitCommand `kong:"cmd" help:"Create a configuration file based on the contents of the project directory."`
	Deploy   commands.CreateCmd   `kong:"cmd" help:"Create a new deployment."`
	Redeploy commands.UpdateCmd   `kong:"cmd" help:"Update an existing deployment."`
	UI       commands.UICmd       `kong:"cmd" help:"Serve the publisher UI."`
	Version  commands.VersionFlag `help:"Show the client software version and exit."`
}

func logVersion(log logging.Logger) {
	log.Info("Client version", "version", project.Version)
	log.Info("Development mode", "mode", project.Mode)
	log.Info("Development build", "DevelopmentBuild", project.DevelopmentBuild())
}

func Fatal(log logging.Logger, msg string, err error, args ...any) {
	args = append([]any{"error", err.Error()}, args...)
	log.Error(msg, args...)
	fmt.Fprintln(os.Stderr, "\n"+strings.TrimSpace(err.Error())+".")
	os.Exit(1)
}

func main() {
	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       afero.NewOsFs(),
		Logger:   events.NewStructuredLogger(0),
	}
	cli := cliSpec{
		CommonArgs: cli_types.CommonArgs{},
	}
	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	if cli.Profile != "" {
		f, err := os.Create(cli.Profile)
		if err != nil {
			Fatal(ctx.Logger, "Error creating file for profile data", err)
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	ctx.Logger = events.NewStructuredLogger(cli.Verbose)
	ctx.Accounts = accounts.NewAccountList(ctx.Fs, ctx.Logger)
	logVersion(ctx.Logger)
	err := args.Run(&cli.CommonArgs)
	if err != nil {
		Fatal(ctx.Logger, "Error running command", err)
	}
}
