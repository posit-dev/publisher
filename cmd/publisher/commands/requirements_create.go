package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"os"

	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/util"
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
	inspector, _ := inspect.NewPythonInspector(absPath, nil, ctx.Logger, nil)
	reqs, incomplete, pythonExecutable, err := inspector.ScanRequirements(absPath)
	if err != nil {
		return err
	}
	err = pydeps.WriteRequirementsFile(reqPath, reqs, util.NewAbsolutePath("bogus python executable", nil))
	if err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "Wrote file %s:\n", cmd.Output)
	fmt.Println("Using package information from", pythonExecutable)
	if len(incomplete) > 0 {
		fmt.Println("Warning: could not find some package versions in your local Python library.")
		fmt.Println("Consider installing these packages and re-running.")
		for _, pkg := range incomplete {
			fmt.Println(pkg)
		}
	}
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
