package commands

import (
	"fmt"
	"net/url"
	"os"

	"connect-client/bundles"
	"connect-client/services/proxy"
)

// Copyright (C) 2023 by Posit Software, PBC.

type PublishCmd struct {
	Name      string   `short:"n" help:"Nickname of destination publishing account."`
	Exclude   []string `short:"x" help:"list of file patterns to exclude"`
	SourceDir string   `arg:"" type"existingdir"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	bundleFile, err := os.CreateTemp(".", "bundle-*.tar.gz")
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	bundle, err := bundles.NewBundleFromDirectory(cmd.SourceDir, cmd.Exclude, bundleFile, ctx.Logger)
	if err != nil {
		return err
	}
	fmt.Printf("bundle file: %s\n", bundleFile.Name())
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
