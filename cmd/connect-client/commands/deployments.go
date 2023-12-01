package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/util"
)

type ListDeploymentsCmd struct {
	Path       util.Path `default:"." help:"Path to directory containing files to publish. Defaults to the current directory." arg:"" default:"."`
	ConfigName string    `name:"config" short:"c" help:"List deployments using the specified configuration."`
}

func (cmd *ListDeploymentsCmd) listDeployments() ([]*deployment.Deployment, error) {
	paths, err := deployment.ListLatestDeploymentFiles(cmd.Path)
	if err != nil {
		return nil, err
	}
	all := make([]*deployment.Deployment, 0, len(paths))
	for _, path := range paths {
		d, err := deployment.FromFile(path)
		if err != nil {
			return nil, err
		}
		if cmd.ConfigName != "" && d.ConfigName != cmd.ConfigName {
			continue
		}
		all = append(all, d)
	}
	return all, nil
}

func (cmd *ListDeploymentsCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	all, err := cmd.listDeployments()
	if err != nil {
		return err
	}
	if len(all) == 0 {
		fmt.Println("No deployments yet. Use the 'publish' or 'publish-ui' command to create one.")
		return nil
	}
	const format = "%-37s %-20s %s\n"
	fmt.Printf(format, "ID", "Configuration", "Server")

	for _, d := range all {
		fmt.Printf(format, d.Id, d.ConfigName, d.ServerURL)
	}
	return nil
}
