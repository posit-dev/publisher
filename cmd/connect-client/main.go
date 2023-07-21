package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/alecthomas/kong"
	"github.com/rstudio/connect-client/cmd/connect-client/commands"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type cliSpec struct {
	commands.CommonArgs
	commands.AccountCommands `group:"Accounts"`

	Publish       commands.PublishCmd       `kong:"cmd" help:"Publish a project."`
	PublishUI     commands.PublishUICmd     `kong:"cmd" help:"Publish a project using the UI."`
	CreateBundle  commands.CreateBundleCmd  `kong:"cmd" help:"Create a bundle file for a project directory."`
	WriteManifest commands.WriteManifestCmd `kong:"cmd" help:"Create a manifest.json file for a project directory."`
	Version       commands.VersionFlag      `help:"Show the client software version and exit."`
}

func logVersion(logger rslog.Logger) {
	logger.WithField("version", project.Version).Infof("Client version")
	logger.WithField("mode", project.Mode).Infof("Production mode")
	logger.WithField("productionBuild", project.ProductionBuild()).Infof("Production build")
}

func setupLogging() rslog.Logger {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.InfoLevel)
	return logger
}

func makeContext(logger rslog.Logger) (*commands.CLIContext, error) {
	fs := afero.NewOsFs()
	accountList := accounts.NewAccountList(fs, logger)
	token, err := services.NewLocalToken()
	if err != nil {
		return nil, err
	}
	ctx := commands.NewCLIContext(accountList, token, fs, logger)
	return ctx, nil
}

func main() {
	logger := setupLogging()
	logVersion(logger)
	defer rslog.Flush()

	ctx, err := makeContext(logger)
	if err != nil {
		logger.Fatalf("Error initializing client: %s", err)
	}
	cli := cliSpec{
		CommonArgs: commands.CommonArgs{},
	}
	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	cmd, ok := args.Selected().Target.Interface().(commands.StatefulCommand)
	if ok {
		// For these commands, we need to load saved deployment state
		// from file, then overlay the alread-parsed CLI arguments on top.
		err = cmd.LoadState(ctx.Logger)
		if err != nil {
			logger.Fatalf("Error loading saved deployment: %s", err)
		}
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			logger.Fatalf("Error: %s", err)
		}
		err = cmd.SaveState(ctx.Logger)
		if err != nil {
			logger.Fatalf("Error saving deployment: %s", err)
		}
	} else {
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			logger.Fatalf("Error: %s", err)
		}
	}
}
