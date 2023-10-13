package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/alecthomas/kong"
	"github.com/rstudio/connect-client/cmd/connect-client/commands"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/spf13/afero"
)

type cliSpec struct {
	cli_types.CommonArgs
	commands.AccountCommands `group:"Accounts"`

	Publish       commands.PublishCmd       `kong:"cmd" help:"Publish a project."`
	PublishUI     commands.PublishUICmd     `kong:"cmd" help:"Publish a project using the UI."`
	CreateBundle  commands.CreateBundleCmd  `kong:"cmd" help:"Create a bundle file for a project directory."`
	WriteManifest commands.WriteManifestCmd `kong:"cmd" help:"Create a manifest.json file for a project directory."`
	Version       commands.VersionFlag      `help:"Show the client software version and exit."`
}

func logVersion(log logging.Logger) {
	log.Info("Client version", "version", project.Version)
	log.Info("Development mode", "mode", project.Mode)
	log.Info("Development build", "DevelopmentBuild", project.DevelopmentBuild())
}

func makeContext(log logging.Logger) (*cli_types.CLIContext, error) {
	fs := afero.NewOsFs()
	accountList := accounts.NewAccountList(fs, log)
	token, err := services.NewLocalToken()
	if err != nil {
		return nil, err
	}
	ctx := cli_types.NewCLIContext(accountList, token, fs, log)
	return ctx, nil
}

func Fatal(log logging.Logger, msg string, err error, args ...any) {
	args = append([]any{"error", err.Error()}, args...)
	log.Error(msg, args...)
	os.Exit(1)
}

func main() {
	log := events.NewLogger(false)
	logVersion(log)

	ctx, err := makeContext(log)
	if err != nil {
		Fatal(log, "Error initializing client", err)
	}
	cli := cliSpec{
		CommonArgs: cli_types.CommonArgs{},
	}
	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	if cli.Debug {
		ctx.Logger = events.NewLogger(true)
	}
	if cli.Token != nil {
		ctx.LocalToken = *cli.Token
	}
	cmd, ok := args.Selected().Target.Interface().(commands.StatefulCommand)
	if ok {
		// For these commands, we need to load saved deployment state
		// from file, then overlay the alread-parsed CLI arguments on top.
		err = cmd.LoadState(ctx)
		if err != nil {
			Fatal(log, "Error loading saved deployment", err)
		}
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			Fatal(log, "Error running command", err)
		}
		err = cmd.SaveState(ctx)
		if err != nil {
			Fatal(log, "Error saving deployment", err)
		}
	} else {
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			Fatal(log, "Error running command", err)
		}
	}
}
