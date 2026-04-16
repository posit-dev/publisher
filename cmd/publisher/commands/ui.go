package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/services/api"
	"github.com/posit-dev/publisher/internal/util"
)

type UICmd struct {
	Path        util.Path `help:"Sets the current working directory for the agent." arg:"" default:"."`
	Listen      string    `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
	UseKeychain bool      `help:"Use Keychain services to store/manage credentials." default:"true"`
}

func (cmd *UICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	ctx.Logger.Info("Starting PublishUICmd.Run")

	log := events.NewCLILogger(args.Verbose, os.Stderr)

	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}

	credentials.UseKeychain = cmd.UseKeychain

	accountList, err := accounts.NewAccountList(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}

	svc := api.NewService(
		"/",
		cmd.Listen,
		true,
		absPath,
		accountList,
		log)
	ctx.Logger.Info("created UI service")
	return svc.Run()
}
