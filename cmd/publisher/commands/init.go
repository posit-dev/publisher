package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"strings"

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

const contentTypeDetectionFailed = " Could not determine content type and entrypoint.\n\n" +
	"Edit the configuration file (%s) \n" +
	"and set the 'type' to a valid deployment type. Valid types are: \n%s\n\n" +
	"Set 'entrypoint' to the main file being deployed. For apps and APIs\n" +
	"this is usually app.py, api.py, app.R, or plumber.R; for reports,\n" +
	"it is your .qmd, .Rmd, or .ipynb file"

func formatValidTypes() string {
	t := config.AllValidContentTypeNames()
	const perLine = 3
	result := ""
	for i := 0; i < len(t); i += perLine {
		var line []string
		if i+perLine >= len(t) {
			line = t[i:]
		} else {
			line = t[i : i+perLine]
		}
		result += "    " + strings.Join(line, ", ") + "\n"
	}
	return result
}

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
		return fmt.Errorf(contentTypeDetectionFailed, configPath, formatValidTypes())
	}
	return nil
}
