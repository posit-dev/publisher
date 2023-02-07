package commands

import (
	"net/url"

	"connect-client/services/proxy"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	AccountSpec `group:"Account:"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	if args.Serve {
		return cmd.Serve(args, ctx)
	}
	return nil
}

func (cmd *PublishCmd) Serve(args *CommonArgs, ctx *CLIContext) error {
	serverURL, err := url.Parse(cmd.account.URL)
	if err != nil {
		return err
	}
	svc := proxy.NewProxyService(
		cmd.account.Name,
		serverURL,
		args.Listen,
		args.TLSKeyFile,
		args.TLSCertFile,
		args.Interactive,
		args.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}
