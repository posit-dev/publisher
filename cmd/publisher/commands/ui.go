package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/services/ui"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type PublishUICmd struct {
	Path          util.Path `help:"Path to directory containing files to publish." arg:"" default:"."`
	Interactive   bool      `short:"i" help:"Launch a browser to show the UI at the listen address."`
	OpenBrowserAt string    `help:"Launch a browser to show the UI at specific network address." placeholder:"HOST[:PORT]" hidden:""`
	Theme         string    `help:"UI theme, 'light' or 'dark'." hidden:""`
	Listen        string    `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
	AccessLog     bool      `help:"Log all HTTP requests."`
	TLSKeyFile    string    `help:"Path to TLS private key file for the UI server."`
	TLSCertFile   string    `help:"Path to TLS certificate chain file for the UI server."`
}

func (cmd *PublishUICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	ctx.Logger.Info("Starting PublishUICmd.Run")
	eventServer := sse.New()
	ctx.Logger.Info("created event server")
	eventServer.CreateStream("messages")
	ctx.Logger.Info("created event stream")

	err := initialize.InitIfNeeded(cmd.Path, config.DefaultConfigName, ctx.Logger)
	if err != nil {
		return err
	}
	stateStore, err := state.New(cmd.Path, "", config.DefaultConfigName, "", ctx.Accounts)
	if err != nil {
		return err
	}
	ctx.Logger.Info("created state store")

	log := events.NewLoggerWithSSE(args.Debug, eventServer)
	ctx.Logger.Info("created SSE logger")

	// Auto-initialize if needed. This will be replaced by an API call from the UI
	// for better error handling and startup performance.
	svc := ui.NewUIService(
		"/",
		cmd.Interactive,
		cmd.OpenBrowserAt,
		cmd.Theme,
		cmd.Listen,
		cmd.AccessLog,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Path,
		stateStore,
		ctx.Accounts,
		log,
		eventServer)
	ctx.Logger.Info("created UI service")
	return svc.Run()
}
