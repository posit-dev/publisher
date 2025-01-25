package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/util"
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
	inspector, _ := inspect.NewPythonInspector(absPath, cmd.Python, ctx.Logger, nil, nil)
	reqs, incomplete, pythonExecutable, err := inspector.ScanRequirements(absPath)
	if err != nil {
		return err
	}
	if len(incomplete) > 0 {
		fmt.Println("# Warning: could not find some package versions in your local Python library.")
		fmt.Println("# Consider installing these packages and re-running.")
		for _, pkg := range incomplete {
			fmt.Println("#", pkg)
		}
	}
	fmt.Println("# Project dependencies for", absPath)
	fmt.Println("# Using package information from", pythonExecutable)
	fmt.Println(strings.Join(reqs, "\n"))
	return nil
}
