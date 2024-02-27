package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/util"
)

type ShowRequirementsCommand struct {
	Path   util.Path `help:"Path to project directory containing files to publish." arg:"" default:"."`
	Python util.Path `help:"Path to Python interpreter for this content, if it is Python-based. Default is the Python 3 on your PATH."`
}

func (cmd *ShowRequirementsCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}
	inspector := inspect.NewPythonInspector(absPath, cmd.Python, ctx.Logger)
	reqs, pythonExecutable, err := inspector.GetRequirements(absPath)
	if err != nil {
		return err
	}
	fmt.Println("# Project dependencies for", absPath)
	fmt.Println("# Using package information from", pythonExecutable)
	fmt.Println(strings.Join(reqs, "\n"))
	return nil
}
