package commands

import (
	"bufio"
	"fmt"
	"net/url"

	"connect-client/bundles"
	"connect-client/services/proxy"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	AccountSpec `group:"Account:"`
	Exclude     []string `short:"x" help:"list of file patterns to exclude"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	if args.Serve {
		return cmd.Serve(args, ctx)
	}
	var buf bufio.Writer
	bundle, err := bundles.NewBundleFromDirectory(".", cmd.Exclude, &buf, ctx.Logger)
	if err != nil {
		return err
	}
	fmt.Printf("bundle: %+v\n", bundle)
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
