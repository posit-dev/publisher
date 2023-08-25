package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"log/slog"

	"github.com/alecthomas/kong"
	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/cmd/connect-client/commands"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/util"
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

func logVersion(logger *slog.Logger) {
	logger.Info("Client version", "version", project.Version)
	logger.Info("Development mode", "mode", project.Mode)
	logger.Info("Development build", "DevelopmentBuild", project.DevelopmentBuild())
}

func newLogger(level slog.Leveler) *slog.Logger {
	stderrHandler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	var sseServer *sse.Server // TODO: create the server
	sseHandler := events.NewSSEHandler(sseServer, &events.SSEHandlerOptions{Level: level})
	multiHandler := util.NewMultiHandler(stderrHandler, sseHandler)
	return slog.New(multiHandler)
}

func makeContext(logger *slog.Logger) (*cli_types.CLIContext, error) {
	fs := afero.NewOsFs()
	accountList := accounts.NewAccountList(fs, logger)
	token, err := services.NewLocalToken()
	if err != nil {
		return nil, err
	}
	ctx := cli_types.NewCLIContext(accountList, token, fs, logger)
	return ctx, nil
}

func Fatal(logger *slog.Logger, msg string, err error, args ...any) {
	args = append([]any{"error", err.Error()}, args...)
	logger.Error(msg, args...)
	os.Exit(1)
}

func main() {
	logger := newLogger(slog.LevelInfo)
	logVersion(logger)

	ctx, err := makeContext(logger)
	if err != nil {
		Fatal(logger, "Error initializing client", err)
	}
	cli := cliSpec{
		CommonArgs: cli_types.CommonArgs{},
	}
	// Dispatch to the Run() method of the selected command.
	args := kong.Parse(&cli, kong.Bind(ctx))
	if cli.Debug {
		ctx.Logger = newLogger(slog.LevelDebug)
	}
	if cli.Token != nil {
		ctx.LocalToken = *cli.Token
	}
	cmd, ok := args.Selected().Target.Interface().(commands.StatefulCommand)
	if ok {
		// For these commands, we need to load saved deployment state
		// from file, then overlay the alread-parsed CLI arguments on top.
		err = cmd.LoadState(ctx.Logger)
		if err != nil {
			Fatal(logger, "Error loading saved deployment", err)
		}
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			Fatal(logger, "Error running command", err)
		}
		err = cmd.SaveState(ctx.Logger)
		if err != nil {
			Fatal(logger, "Error saving deployment", err)
		}
	} else {
		err = args.Run(&cli.CommonArgs)
		if err != nil {
			Fatal(logger, "Error running command", err)
		}
	}
}
