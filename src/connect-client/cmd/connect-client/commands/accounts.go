package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/accounts"
	"connect-client/api_client/clients"
	"fmt"
	"net/url"
	"os"
	"time"
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
	Name string `short:"n" help:"Nickname of account to remove."`
}

func (cmd *removeAccountCmd) Run(args *CommonArgs) error {
	return nil
}

type testAccountCmd struct {
	Name string `short:"n" help:"Nickname of account to test."`
}

func (cmd *testAccountCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.Name)
	if err != nil {
		return err
	}
	client, err := clients.NewConnectClient(account, 30*time.Second, ctx.Logger)
	if err != nil {
		return err
	}
	err = client.TestConnection()
	if err != nil {
		return err
	}
	if account.AuthType != accounts.AuthTypeNone {
		err = client.TestAuthentication()
		if err != nil {
			return err
		}
	}
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
	TestAccount   testAccountCmd   `cmd:"" help:"Verify connectivity and credentials for a publishing account."`
}
