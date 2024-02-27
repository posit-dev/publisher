package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/util"
)

type CreateRequirementsCommand struct {
	Path   util.Path `help:"Path to project directory containing files to publish." arg:"" default:"."`
	Python util.Path `help:"Path to Python interpreter for this content, if it is Python-based. Default is the Python 3 on your PATH."`
	Output string    `short:"o" help:"Name of output file." default:"requirements.txt"`
	Force  bool      `short:"f" help:"Overwrite the output file, if it exists."`
}

var errRequirementsFileExists = errors.New("the requirements file already exists; use the -f option to overwrite it")

func (cmd *CreateRequirementsCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	absPath, err := cmd.Path.Abs()
	if err != nil {
		return err
	}
	reqPath := absPath.Join(cmd.Output)
	exists, err := reqPath.Exists()
	if err != nil {
		return err
	}
	if exists && !cmd.Force {
		return errRequirementsFileExists
	}
	inspector := inspect.NewPythonInspector(absPath, cmd.Python, ctx.Logger)
	err = inspector.CreateRequirementsFile(absPath, reqPath)
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Wrote file %s:\n", cmd.Output)
	content, err := reqPath.ReadFile()
	if err != nil {
		return err
	}
	_, err = os.Stdout.Write(content)
	if err != nil {
		return err
	}
	return nil
}
