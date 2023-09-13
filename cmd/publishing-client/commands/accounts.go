package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/rstudio/publishing-client/internal/accounts"
	"github.com/rstudio/publishing-client/internal/api_client/clients"
	"github.com/rstudio/publishing-client/internal/cli_types"
)

type addAccountCmd struct {
	Name        string   `short:"n" help:"Nickname for the account."`
	URL         *url.URL `short:"u" help:"Server URL."`
	APIKey      string   `short:"k" help:"API key."`
	Certificate *os.File `help:"Path to CA certificate bundle."`
	Insecure    bool     `help:"Don't validate server certificate."`
}

func (cmd *addAccountCmd) Run(args *cli_types.CommonArgs) error {
	return nil
}

type removeAccountCmd struct {
	Name string `short:"n" help:"Nickname of account to remove."`
}

func (cmd *removeAccountCmd) Run(args *cli_types.CommonArgs) error {
	return nil
}

type testAccountCmd struct {
	Name string `short:"n" help:"Nickname of account to test."`
}

func (cmd *testAccountCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
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

func (cmd *listAccountsCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	accounts, err := ctx.Accounts.GetAllAccounts()
	if err != nil {
		return err
	}
	if len(accounts) == 0 {
		fmt.Println("No accounts are saved. To add an account, see `publishing-client add-server --help`.")
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

type AccountCommands struct {
	AddAccount    addAccountCmd    `kong:"cmd" help:"Add a publishing account."`
	RemoveAccount removeAccountCmd `kong:"cmd" help:"Remove a publishing account. Specify by name or URL."`
	ListAccounts  listAccountsCmd  `kong:"cmd" help:"List publishing accounts."`
	TestAccount   testAccountCmd   `kong:"cmd" help:"Verify connectivity and credentials for a publishing account."`
}
