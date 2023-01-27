package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/project"
	"fmt"

	"github.com/alecthomas/kong"
)

type versionCmd struct{}

func (cmd *versionCmd) Run(ctx *global) error {
	fmt.Println(project.Version)
	return nil
}

type global struct {
	Debug       bool       `help:"Enable debug mode."`
	Serve       bool       `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool       `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Version     versionCmd `cmd:"" help:"Show the client software version."`
}

func (args *global) resolve() {
	if args.Interactive {
		args.Serve = true
	}
}

type cliArgs struct {
	global
	serverCommands
}

func main() {
	args := cliArgs{}
	ctx := kong.Parse(&args)
	args.global.resolve()

	// Dispatch to the Run() method of the selected command.
	err := ctx.Run(&args.global)
	ctx.FatalIfErrorf(err)
}
