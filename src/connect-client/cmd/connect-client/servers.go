package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"

	"connect-client/servers"
)

// serverSpec contains the info about a saved server in the server list.
// The user can specify a saved server by name or URL (but not both).
type serverSpec struct {
	URL  *url.URL `short:"u" xor:"spec" required:"" help:"URL of the server URL to remove."`
	Name string   `short:"n" xor:"spec" required:"" help:"Nickname of the server to remove."`
}

type addServerCmd struct {
	URL         *url.URL `short:"u" help:"Server URL."`
	Name        string   `short:"n" help:"Nickname for the server."`
	APIKey      string   `short:"k" help:"API key."`
	Certificate *os.File `help:"Path to CA certificate bundle."`
	Insecure    bool     `help:"Don't validate server certificate."`
}

func (cmd *addServerCmd) Run(ctx *commonArgs) error {
	fmt.Printf("add-server: %+v %+v", ctx, cmd)
	return nil
}

type removeServerCmd struct {
	serverSpec `group:"Server:"`
}

func (cmd *removeServerCmd) Run(ctx *commonArgs) error {
	fmt.Printf("remove-server: %+v %+v", ctx, cmd)
	return nil
}

type listServersCmd struct{}

func (cmd *listServersCmd) Run(ctx *commonArgs) error {
	ctx.debugLogger.Debugf("list-servers: %+v %+v", ctx, cmd)

	serverList, err := servers.ReadRsconnectPythonServers()
	if err != nil {
		ctx.logger.Fatalf("Could not load server list: %s", err)
	}

	if len(serverList) == 0 {
		fmt.Println("No servers are saved. To add a server, see `connect-client add --help`.")
	} else {
		fmt.Println()
		for _, server := range serverList {
			fmt.Printf("Nickname: \"%s\"\n", server.Name)
			fmt.Printf("    URL: %s\n", server.URL)
			if server.ApiKey != "" {
				fmt.Println("    API key is saved")
			}
			if server.Insecure {
				fmt.Println("    Insecure mode (TLS host/certificate validation disabled)")
			}
			if server.Certificate != "" {
				fmt.Printf("    Client TLS certificate data provided")
			}
			fmt.Println()
		}
	}
	return nil
}

type serverCommands struct {
	AddServer    addServerCmd    `cmd:"" help:"Add a publishing server."`
	RemoveServer removeServerCmd `cmd:"" help:"Remove a publishing server. Specify by name or URL."`
	ListServers  listServersCmd  `cmd:"" help:"List publishing servers."`
}
