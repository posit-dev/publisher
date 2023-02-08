package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"
)

type addAccountCmd struct {
	Name        string   `short:"n" help:"Nickname for the account."`
	URL         *url.URL `short:"u" help:"Server URL."`
	APIKey      string   `short:"k" help:"API key."`
	Certificate *os.File `help:"Path to CA certificate bundle."`
	Insecure    bool     `help:"Don't validate server certificate."`
}

func (cmd *addAccountCmd) Run(args *CommonArgs) error {
	return nil
}

type removeAccountCmd struct {
	accountSpec AccountSpec `group:"Account:"`
}

func (cmd *removeAccountCmd) Run(args *CommonArgs) error {
	return nil
}

type listAccountsCmd struct{}

func (cmd *listAccountsCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	if args.Serve {
		return cmd.Serve(args, ctx)
	}

	accounts := ctx.Accounts.GetAllAccounts()
	if len(accounts) == 0 {
		fmt.Println("No accounts are saved. To add an account, see `connect-client add-server --help`.")
	} else {
		fmt.Println()
		for _, account := range accounts {
			fmt.Printf("Nickname: \"%s\"\n", account.Name)
			fmt.Printf("    Server URL: %s\n", account.URL)
			fmt.Printf("    Configured via: %s\n", account.Source.Description())
			fmt.Printf("    Authentication: %s\n", account.AuthType.Description())
			if account.Insecure {
				fmt.Println("    Insecure mode (TLS host/certificate validation disabled)")
			}
			if account.Certificate != "" {
				fmt.Println("    Client TLS certificate data provided")
			}
			fmt.Println()
		}
	}
	return nil
}

func (cmd *listAccountsCmd) Serve(args *CommonArgs, ctx *CLIContext) error {
	return RunUI("#accounts", args, ctx)
}

type accountUICmd struct{}

type AccountCommands struct {
	AddAccount    addAccountCmd    `cmd:"" help:"Add a publishing account."`
	RemoveAccount removeAccountCmd `cmd:"" help:"Remove a publishing account. Specify by name or URL."`
	ListAccounts  listAccountsCmd  `cmd:"" help:"List publishing accounts."`
}
