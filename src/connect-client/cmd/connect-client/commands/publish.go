package commands

import (
	connect_client "connect-client"
	"fmt"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	ServerSpec `group:"Server:"`
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
		cmd.server.Name,
		cmd.server.URL,
		args.Host,
		args.Port,
		ctx.Logger)
	return app.Run()
}
