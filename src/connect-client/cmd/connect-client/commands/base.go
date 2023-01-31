package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/url"
	"os"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type UIArgs struct {
	Serve       bool   `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool   `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Host        string `default:"localhost" help:"Hostname to listen on. Default: 'localhost'"`
	Port        int    `default:"4242" help:"Post number to listen on. Default: automatic port selection."`
}

type CommonArgs struct {
	UIArgs `group:"UI"`
	Debug  debugFlag `help:"Enable debug mode." env:"CONNECT_DEBUG"`
}

func (args *CommonArgs) Resolve() {
	if args.Interactive {
		args.Serve = true
	}
}

type CLIContext struct {
	Logger      rslog.Logger      `kong:"-"`
	DebugLogger rslog.DebugLogger `kong:"-"`
}

func NewCLIContext() *CLIContext {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)

	return &CLIContext{
		Logger:      logger,
		DebugLogger: rslog.NewDebugLogger(GeneralRegion),
	}
}

// serverSpec contains the info about a saved server in the server list.
// The user must specify a saved server by name or URL (but not both).
type serverSpec struct {
	URL  *url.URL `short:"u" xor:"spec" required:"" help:"URL of the server URL to remove."`
	Name string   `short:"n" xor:"spec" required:"" help:"Nickname of the server to remove."`
}
