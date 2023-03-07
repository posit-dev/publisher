package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/accounts"
	"connect-client/api_client/clients"
	"connect-client/services/ui"
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
	// TODO: create and call a generic factory to make a new client for any account
	client, err := clients.NewConnectClient(account, 30*time.Second, ctx.Logger)
	if err != nil {
		return err
	}
	err = client.TestConnection()
	if err != nil {
		return err
	}
	if account.AuthType != accounts.AuthTypeNone {
		user, err := client.TestAuthentication()
		if err != nil {
			return err
		}
		if user.FirstName != "" || user.LastName != "" {
			fmt.Printf("Name:     %s %s\n", user.FirstName, user.LastName)
		}
		if user.Username != "" {
			fmt.Printf("Username: %s\n", user.Username)
		}
		if user.Id != "" {
			fmt.Printf("ID:       %s\n", user.Id)
		}
		if user.Email != "" {
			fmt.Printf("Email:    %s\n", user.Email)
		}
	}
	return nil
}

type listAccountsCmd struct{}

func (cmd *listAccountsCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	accounts, err := ctx.Accounts.GetAllAccounts()
	if err != nil {
		return err
	}
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

type accountUICmd struct {
	UIArgs
}

func (cmd *accountUICmd) Run(args *CommonArgs, ctx *CLIContext) error {
	svc := ui.NewUIService(
		"#accounts",
		cmd.Listen,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Interactive,
		cmd.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}

type AccountCommands struct {
	AccountUI     accountUICmd     `cmd:"" help:"Serve the account management UI."`
	AddAccount    addAccountCmd    `cmd:"" help:"Add a publishing account."`
	RemoveAccount removeAccountCmd `cmd:"" help:"Remove a publishing account. Specify by name or URL."`
	ListAccounts  listAccountsCmd  `cmd:"" help:"List publishing accounts."`
	TestAccount   testAccountCmd   `cmd:"" help:"Verify connectivity and credentials for a publishing account."`
}
