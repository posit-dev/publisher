package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"connect-client/project"

	"github.com/alecthomas/kong"
)

type VersionFlag bool

func (v VersionFlag) BeforeReset(app *kong.Kong, vars kong.Vars) error {
	fmt.Println(project.Version)
	app.Exit(0)
	return nil
}
