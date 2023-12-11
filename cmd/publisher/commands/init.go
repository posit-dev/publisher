package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/initialize"
	"github.com/rstudio/connect-client/internal/util"
)

type InitCommand struct {
	Path       util.Path `help:"Path to directory containing files to publish." arg:"" default:"."`
	Python     util.Path `help:"Path to Python interpreter for this content, if it is Python-based. Default is the Python 3 on your PATH."`
	ConfigName string    `name:"config" short:"c" help:"Configuration name to create (in .posit/publish/)"`
}

const contentTypeDetectionFailed = "could not determine content type; edit the configuration file (%s) to set the 'type' to a valid deployment type and 'entrypoint' to the main entrypoint file"

func (cmd *InitCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	if cmd.ConfigName == "" {
		cmd.ConfigName = config.DefaultConfigName
	}
	cfg, err := initialize.Init(cmd.Path, cmd.ConfigName, cmd.Python, ctx.Logger)
	if err != nil {
		return err
	}
	if cfg.Type == config.ContentTypeUnknown {
		configPath := config.GetConfigPath(cmd.Path, cmd.ConfigName)
		return fmt.Errorf(contentTypeDetectionFailed, configPath)
	}
	return nil
}
