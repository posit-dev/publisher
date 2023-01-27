package main

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"
)

// serverSpec contains the info about a saved server in the server list.
// The user can specify a saved server by name or URL (but not both).
type serverSpec struct {
	URL  *url.URL `short:"u" xor:"spec" required:"" help:"URL of the server URL to remove."`
	Name string   `short:"n" xor:"spec" required:"" help:"Nickname of the server to remove."`
}

type addServerCmd struct {
	URL         *url.URL `short:"u" help:"Connect server URL."`
	Name        string   `short:"n" help:"Nickname for the server."`
	APIKey      string   `short:"k" help:"API key."`
	Certificate *os.File `help:"Path to CA certificate bundle."`
	Insecure    bool     `help:"Don't validate Connect server certificate."`
}

func (cmd *addServerCmd) Run(ctx *global) error {
	fmt.Printf("add-server: %+v %+v", ctx, cmd)
	return nil
}

type removeServerCmd struct {
	serverSpec `group:"Server:"`
}

func (cmd *removeServerCmd) Run(ctx *global) error {
	fmt.Printf("remove-server: %+v %+v", ctx, cmd)
	return nil
}

type listServersCmd struct{}

func (cmd *listServersCmd) Run(ctx *global) error {
	fmt.Printf("list-servers: %+v %+v", ctx, cmd)
	return nil
}

type serverCommands struct {
	AddServer    addServerCmd    `group:"Servers" cmd:"" help:"Add a publishing server."`
	RemoveServer removeServerCmd `group:"Servers" cmd:"" help:"Remove a publishing server."`
	ListServers  listServersCmd  `group:"Servers" cmd:"" help:"List publishing servers."`
}
