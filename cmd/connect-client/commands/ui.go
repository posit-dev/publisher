package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
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
	eventServer := sse.New()
	eventServer.CreateStream("messages")
	stateStore, err := state.New(cmd.Path, "", "default.toml", "", ctx.Accounts)
	if err != nil {
		return err
	}

	log := events.NewLoggerWithSSE(args.Debug, eventServer)
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
	return svc.Run()
}
