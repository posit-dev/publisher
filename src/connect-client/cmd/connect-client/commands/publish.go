package commands

import (
	"net/url"

	"connect-client/services/proxy"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	ServerSpec `group:"Server:"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	if args.Serve {
		return cmd.Serve(args, ctx)
	}
	return nil
}

func (cmd *PublishCmd) Serve(args *CommonArgs, ctx *CLIContext) error {
	serverURL, err := url.Parse(cmd.server.URL)
	if err != nil {
		return err
	}
	svc := proxy.NewProxyService(
		cmd.server.Name,
		serverURL,
		args.Host,
		args.Port,
		args.TLSKeyFile,
		args.TLSCertFile,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}
