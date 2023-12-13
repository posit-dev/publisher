package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type UpdateCmd struct {
	TargetName string                 `arg:"" help:"Name of deployment to update (in .posit/deployments/)"`
	Path       util.Path              `help:"Path to directory containing files to publish." arg:"" default:"."`
	ConfigName string                 `name:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	Config     *config.Config         `kong:"-"`
	Target     *deployment.Deployment `kong:"-"`
}

func (cmd *UpdateCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	ctx.Logger = events.NewSimpleLogger(args.Verbose)

	err := initialize.InitIfNeeded(cmd.Path, cmd.ConfigName, ctx.Logger)
	if err != nil {
		return err
	}
	cmd.TargetName = strings.TrimSuffix(cmd.TargetName, ".toml")
	stateStore, err := state.New(cmd.Path, "", cmd.ConfigName, cmd.TargetName, "", ctx.Accounts)
	if err != nil {
		return err
	}
	if stateStore.Account == nil {
		return errNoAccounts
	}
	ctx.Logger.Info(
		"Update",
		"name", stateStore.TargetName,
		"configuration", stateStore.ConfigName)
	publisher := publish.NewFromState(stateStore)
	return publisher.PublishDirectory(ctx.Logger)
}
