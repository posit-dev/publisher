package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/project"
)

type VersionCmd struct{}

func (cmd *VersionCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	fmt.Println(project.Version)
	return nil
}
