package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/util"
)

type RequirementsCommand struct {
	Path   util.Path `help:"Path to project directory containing files to publish." arg:"" default:"."`
	Python util.Path `help:"Path to Python interpreter for this content, if it is Python-based. Default is the Python 3 on your PATH."`
	Output string    `short:"o" help:"Name of output file." default:"requirements.txt"`
}

func (cmd *RequirementsCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}
	inspector := inspect.NewPythonInspector(cmd.Python, ctx.Logger)
	reqPath := absPath.Join(cmd.Output)
	err = inspector.CreateRequirementsFile(absPath, reqPath)
	if err != nil {
		return err
	}
	if args.Verbose >= 2 {
		content, err := reqPath.ReadFile()
		if err != nil {
			return err
		}
		fmt.Println()
		_, err = os.Stdout.Write(content)
		if err != nil {
			return err
		}
	}
	return nil
}
