package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"strings"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type PublishCmd struct {
	Path        util.Path              `help:"Path to directory containing files to publish." arg:"" default:"."`
	AccountName string                 `name:"account" short:"n" help:"Nickname of destination publishing account."`
	ConfigName  string                 `name:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	TargetName  string                 `name:"update" short:"u" help:"Name of deployment to update (in .posit/deployments/)"`
	SaveName    string                 `name:"save-name" short:"s" help:"Save deployment with this name (in .posit/deployments/)"`
	Account     *accounts.Account      `kong:"-"`
	Config      *config.Config         `kong:"-"`
	Target      *deployment.Deployment `kong:"-"`
}

var errNoAccounts = errors.New("there are no accounts yet; register an account before publishing")

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	if cmd.SaveName != "" {
		err := util.ValidateFilename(cmd.SaveName)
		if err != nil {
			return err
		}
	}
	err := initialize.InitIfNeeded(cmd.Path, cmd.ConfigName, ctx.Logger)
	if err != nil {
		return err
	}
	cmd.TargetName = strings.TrimSuffix(cmd.TargetName, ".toml")
	stateStore, err := state.New(cmd.Path, cmd.AccountName, cmd.ConfigName, cmd.TargetName, cmd.SaveName, ctx.Accounts)
	if err != nil {
		return err
	}
	if stateStore.Account == nil {
		return errNoAccounts
	}
	ctx.Logger.Info(
		"Publish",
		"configuration", stateStore.ConfigName,
		"account", stateStore.AccountName,
		"target", stateStore.TargetName)
	publisher := publish.NewFromState(stateStore)
	return publisher.PublishDirectory(ctx.Logger)
}
