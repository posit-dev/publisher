package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/initialize"
	"github.com/posit-dev/publisher/internal/publish"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util"
)

type DeployCmd struct {
	Path        util.Path         `help:"Path to project directory containing files to publish." arg:"" default:"."`
	AccountName string            `name:"account" short:"a" help:"Nickname of the publishing account to use (run list-accounts to see them)."`
	ConfigName  string            `name:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	SaveName    string            `name:"name" short:"n" help:"Save deployment with this name (in .posit/deployments/)"`
	Account     *accounts.Account `kong:"-"`
	Config      *config.Config    `kong:"-"`
}

func (cmd *DeployCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}

	ctx.Logger = events.NewCLILogger(args.Verbose, os.Stderr)

	if cmd.SaveName != "" {
		err = util.ValidateFilename(cmd.SaveName)
		if err != nil {
			return err
		}
		exists, err := deployment.GetDeploymentPath(absPath, cmd.SaveName).Exists()
		if err != nil {
			return err
		}
		if exists {
			return fmt.Errorf("there is already a deployment named '%s'; did you mean to use the 'redeploy' command?", cmd.SaveName)
		}
	} else {
		cmd.SaveName, err = deployment.UntitledDeploymentName(absPath)
		if err != nil {
			return err
		}
	}
	err = initialize.InitIfNeeded(absPath, cmd.ConfigName, ctx.Logger)
	if err != nil {
		return err
	}
	stateStore, err := state.New(absPath, cmd.AccountName, cmd.ConfigName, "", cmd.SaveName, ctx.Accounts)
	if err != nil {
		return err
	}
	fmt.Printf("Deploy to server %s using account %s and configuration %s, creating deployment %s\n",
		stateStore.Account.URL,
		stateStore.Account.Name,
		stateStore.ConfigName,
		stateStore.SaveName)
	publisher, err := publish.NewFromState(stateStore, events.NewCliEmitter(os.Stderr, ctx.Logger), ctx.Logger)
	if err != nil {
		return err
	}
	return publisher.PublishDirectory(ctx.Logger)
}
