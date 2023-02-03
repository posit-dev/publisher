package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"

	"connect-client/services/ui"
)

type addServerCmd struct {
	URL         *url.URL `short:"u" help:"Server URL."`
	Name        string   `short:"n" help:"Nickname for the server."`
	APIKey      string   `short:"k" help:"API key."`
	Certificate *os.File `help:"Path to CA certificate bundle."`
	Insecure    bool     `help:"Don't validate server certificate."`
}

func (cmd *addServerCmd) Run(args *CommonArgs) error {
	return nil
}

type removeServerCmd struct {
	serverSpec ServerSpec `group:"Server:"`
}

func (cmd *removeServerCmd) Run(args *CommonArgs) error {
	return nil
}

type listServersCmd struct{}

func (cmd *listServersCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	if args.Serve {
		return cmd.Serve(args, ctx)
	}

	servers := ctx.Servers.GetAllServers()
	if len(servers) == 0 {
		fmt.Println("No servers are saved. To add a server, see `connect-client add-server --help`.")
	} else {
		fmt.Println()
		for _, server := range servers {
			fmt.Printf("Nickname: \"%s\"\n", server.Name)
			fmt.Printf("    URL: %s\n", server.URL)
			fmt.Printf("    Configured via: %s\n", server.Source)
			if server.ApiKey != "" {
				fmt.Println("    API key is saved")
			}
			if server.Insecure {
				fmt.Println("    Insecure mode (TLS host/certificate validation disabled)")
			}
			if server.Certificate != "" {
				fmt.Println("    Client TLS certificate data provided")
			}
			fmt.Println()
		}
	}
	return nil
}

func (cmd *listServersCmd) Serve(args *CommonArgs, ctx *CLIContext) error {
	svc := ui.NewUIService(
		args.Listen,
		"#servers",
		args.TLSKeyFile,
		args.TLSCertFile,
		args.Interactive,
		args.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}

type serverUICmd struct{}

type ServerCommands struct {
	AddServer    addServerCmd    `cmd:"" help:"Add a publishing server."`
	RemoveServer removeServerCmd `cmd:"" help:"Remove a publishing server. Specify by name or URL."`
	ListServers  listServersCmd  `cmd:"" help:"List publishing servers."`
}
