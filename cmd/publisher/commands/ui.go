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
	Listen string `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
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

	path := util.NewPath(".", nil)
	absPath, err := path.Abs()
	if err != nil {
		return err
	}

	// Auto-initialize if needed. This will be replaced by an API call from the UI
	// for better error handling and startup performance.
	svc := api.NewService(
		"/",
		cmd.Listen,
		true,
		absPath,
		ctx.Accounts,
		log,
		eventServer,
		emitter)
	ctx.Logger.Info("created UI service")
	return svc.Run()
}
