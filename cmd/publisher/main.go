package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"runtime/pprof"
	"strings"

	"github.com/alecthomas/kong"
	"github.com/posit-dev/publisher/cmd/publisher/commands"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/project"
	"github.com/spf13/afero"
)

type cliSpec struct {
	cli_types.CommonArgs

	Credentials  commands.CredentialsCommand   `kong:"cmd" help:"Manage credentials."`
	Deploy       commands.DeployCmd            `kong:"cmd" help:"Create a new deployment."`
	Init         commands.InitCommand          `kong:"cmd" help:"Create a configuration file based on the contents of the project directory."`
	Redeploy     commands.RedeployCmd          `kong:"cmd" help:"Update an existing deployment."`
	Requirements commands.RequirementsCommands `kong:"cmd" help:"Create a Python requirements.txt file."`
	UI           commands.UICmd                `kong:"cmd" help:"Serve the publisher UI."`
	Version      commands.VersionCmd           `kong:"cmd" help:"Show the client software version and exit."`
}

func logVersion(log logging.Logger) {
	log.Info("Client version", "version", project.Version)
	log.Info("Development mode", "mode", project.Mode)
	log.Info("Development build", "DevelopmentBuild", project.DevelopmentBuild())
}

func Fatal(err error) {
	fmt.Fprintln(os.Stderr, "\n"+strings.TrimSpace(err.Error())+".")
	os.Exit(1)
}

func main() {
	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       afero.NewOsFs(),
		Logger:   events.NewCLILogger(0, os.Stderr),
	}
	cli := cliSpec{
		CommonArgs: cli_types.CommonArgs{},
	}
	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	if cli.Profile != "" {
		f, err := os.Create(cli.Profile)
		if err != nil {
			Fatal(err)
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}
	ctx.Logger = events.NewCLILogger(cli.Verbose, os.Stderr)
	ctx.Accounts = accounts.NewAccountList(ctx.Fs, ctx.Logger)
	logVersion(ctx.Logger)
	err := args.Run(&cli.CommonArgs)
	if err != nil {
		Fatal(err)
	}
}
