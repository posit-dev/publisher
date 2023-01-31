package commands

import (
	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

type UIArgs struct {
	Serve       bool   `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool   `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Host        string `default:"localhost" help:"Hostname to listen on. Default: 'localhost'"`
	Port        int    `default:"4242" help:"Post number to listen on. Default: automatic port selection."`
}

type CommonArgs struct {
	UIArgs `group:"UI"`
	Debug  debugFlag `help:"Enable debug mode." env:"CONNECT_DEBUG"`

	Logger      rslog.Logger      `kong:"-"`
	DebugLogger rslog.DebugLogger `kong:"-"`
}

func (args *CommonArgs) Resolve() {
	if args.Interactive {
		args.Serve = true
	}
	args.DebugLogger = rslog.NewDebugLogger(GeneralRegion)
}
