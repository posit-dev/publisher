package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"strings"

	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
)

type RedeployCmd struct {
	TargetName string                 `name:"deployment-name" arg:"" help:"Name of deployment to update (in .posit/deployments/)"`
	Path       util.Path              `help:"Path to project directory containing files to publish." arg:"" default:"."`
	ConfigName string                 `name:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	Config     *config.Config         `kong:"-"`
	Target     *deployment.Deployment `kong:"-"`
}

func (cmd *RedeployCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}
	ctx.Logger = events.NewCLILogger(args.Verbose, os.Stderr)

	err = initialize.InitIfNeeded(absPath, cmd.ConfigName, ctx.Logger)
	if err != nil {
		return err
	}
	cmd.TargetName = strings.TrimSuffix(cmd.TargetName, ".toml")
	err = util.ValidateFilename(cmd.TargetName)
	if err != nil {
		return fmt.Errorf("invalid deployment name '%s': %w", cmd.TargetName, err)
	}
	stateStore, err := state.New(absPath, "", cmd.ConfigName, cmd.TargetName, "", ctx.Accounts)
	if err != nil {
		return err
	}
	fmt.Printf("Redeploy %s to server %s using account %s and configuration %s\n",
		stateStore.TargetName,
		stateStore.Account.URL,
		stateStore.Account.Name,
		stateStore.ConfigName)

	publisher, err := publish.NewFromState(stateStore, events.NewCliEmitter(os.Stderr, ctx.Logger), ctx.Logger)
	if err != nil {
		return err
	}
	return publisher.PublishDirectory(ctx.Logger)
}
