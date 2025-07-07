package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/services/api"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/r3labs/sse/v2"
)

type UICmd struct {
	Path        util.Path `help:"Sets the current working directory for the agent." arg:"" default:"."`
	Listen      string    `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
	UseKeychain bool      `help:"Use Keychain services to store/manage credentials." default:"true"`
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

	credentials.UseKeychain = cmd.UseKeychain

	// We need to create these only after the credentials.UseKeychain setting has been resolved.
	// This is because NewCredentialsService will use the value of UseKeychain to determine
	// whether to use the keychain or not.
	accountList, err := accounts.NewAccountList(ctx.Fs, ctx.Logger)
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
		accountList,
		log,
		eventServer,
		emitter)
	ctx.Logger.Info("created UI service")
	return svc.Run()
}
