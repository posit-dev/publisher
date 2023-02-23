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
	Name    string   `short:"n" help:"Nickname of destination publishing account."`
	Exclude []string `short:"x" help:"list of file patterns to exclude"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	var buf bufio.Writer
	bundle, err := bundles.NewBundleFromDirectory(".", cmd.Exclude, &buf, ctx.Logger)
	if err != nil {
		return err
	}
	fmt.Printf("bundle: %+v\n", bundle)
	return nil
}

type PublishUICmd struct {
	UIArgs
	PublishCmd
}

func (cmd *PublishUICmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.Name)
	if err != nil {
		return err
	}
	serverURL, err := url.Parse(account.URL)
	if err != nil {
		return err
	}
	svc := proxy.NewProxyService(
		cmd.Name,
		serverURL,
		cmd.Listen,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Interactive,
		cmd.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}
