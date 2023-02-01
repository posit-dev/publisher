package commands

import (
	connect_client "connect-client"
	"fmt"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	serverSpec `group:"Server:"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	fmt.Printf("publish: %+v %+v\n", args, cmd)
	if args.Serve {
		return cmd.Serve(args, ctx)
	}
	return nil
}

func (cmd *PublishCmd) Serve(args *CommonArgs, ctx *CLIContext) error {
	app := connect_client.NewProxyApplication(
		"devpw",
		"https://connect.localtest.me/rsc/dev-password",
		args.Host,
		args.Port,
		bool(args.Debug),
		ctx.Logger,
		ctx.DebugLogger)
	return app.Run()
}
