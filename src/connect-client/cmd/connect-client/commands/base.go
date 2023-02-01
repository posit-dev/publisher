package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"

	"connect-client/servers"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type UIArgs struct {
	Serve       bool   `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool   `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Host        string `default:"0.0.0.0" help:"Hostname or IP to listen on."`
	Port        int    `default:"4242" help:"Post number to listen on."`
}

type CommonArgs struct {
	UIArgs `group:"UI"`
	Debug  debugFlag `help:"Enable debug mode." env:"CONNECT_DEBUG"`
}

func (args *CommonArgs) AfterApply() error {
	if args.Interactive {
		args.Serve = true
	}
	return nil
}

type CLIContext struct {
	Servers servers.ServerList
	Logger  rslog.Logger `kong:"-"`
}

func NewCLIContext() (*CLIContext, error) {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)

	serverList, err := servers.NewServerList()
	if err != nil {
		return nil, err
	}

	return &CLIContext{
		Servers: serverList,
		Logger:  logger,
	}, nil
}

// ServerSpec contains the info about a saved server in the server list.
// The user must specify a saved server by name or URL (but not both).
type ServerSpec struct {
	URL    *url.URL `short:"u" xor:"spec" required:"" help:"URL of the server URL to remove."`
	Name   string   `short:"n" xor:"spec" required:"" help:"Nickname of the server to remove."`
	server servers.Server
}

func (s *ServerSpec) AfterApply(ctx *CLIContext) error {
	// Argument parsing enforces that exactly one of s.Name or s.URL is set
	if s.Name != "" {
		ok, server := ctx.Servers.GetServerByName(s.Name)
		if !ok {
			return fmt.Errorf("Server name '%s' is not defined.", s.Name)
		}
		s.server = server
	}
	if s.URL != nil {
		ok, server := ctx.Servers.GetServerByURL(s.URL.String())
		if !ok {
			return fmt.Errorf("Server url '%s' is not defined.", s.URL)
		}
		s.server = server
	}
	return nil
}
