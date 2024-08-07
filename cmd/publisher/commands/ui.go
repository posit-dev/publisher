package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/services/api"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/r3labs/sse/v2"
)

type UICmd struct {
	Path          util.Path `help:"Path to project directory containing files to publish." arg:"" default:"."`
	Interactive   bool      `short:"i" help:"Launch a browser to show the UI."`
	OpenBrowserAt string    `help:"Network address to use when launching the browser." placeholder:"HOST[:PORT]" hidden:""`
	Theme         string    `help:"UI theme, 'light' or 'dark'." hidden:""`
	Listen        string    `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
	TLSKeyFile    string    `help:"Path to TLS private key file for the UI server."`
	TLSCertFile   string    `help:"Path to TLS certificate chain file for the UI server."`
}

func (cmd *UICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	ctx.Logger.Info("Starting PublishUICmd.Run")
	eventServer := sse.New()
	ctx.Logger.Info("created event server")
	eventServer.CreateStream("messages")
	ctx.Logger.Info("created event stream")

	emitter := events.NewSSEEmitter(eventServer)
	log := events.NewLoggerWithSSE(args.Verbose, emitter)
	ctx.Logger.Info("created SSE logger")

	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}

	// Auto-initialize if needed. This will be replaced by an API call from the UI
	// for better error handling and startup performance.
	svc := api.NewService(
		"/",
		cmd.Interactive,
		cmd.OpenBrowserAt,
		cmd.Theme,
		cmd.Listen,
		true,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		absPath,
		ctx.Accounts,
		log,
		eventServer,
		emitter)
	ctx.Logger.Info("created UI service")
	return svc.Run()
}
