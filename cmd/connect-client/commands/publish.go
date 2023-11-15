package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/util"
)

type PublishCmd struct {
	Path        util.Path          `help:"Path to directory containing files to publish." arg:"" default:"."`
	AccountName string             `name:"account" short:"n" help:"Nickname of destination publishing account."`
	ConfigName  string             `name:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	TargetID    string             `name:"update" short:"u" help:"ID of deployment to update (in .posit/deployments/)"`
	Account     *accounts.Account  `kong:"-"`
	Config      *config.Config     `kong:"-"`
	Target      *config.Deployment `kong:"-"`
}

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	if cmd.ConfigName == "" {
		cmd.ConfigName = config.DefaultConfigName
	}
	publisher, err := publish.New(cmd.Path, cmd.AccountName, cmd.ConfigName, cmd.TargetID, ctx.Accounts)
	if err != nil {
		return err
	}
	return publisher.PublishDirectory(ctx.Logger)
}
