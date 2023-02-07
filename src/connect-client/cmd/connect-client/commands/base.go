package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"

	"connect-client/accounts"
	"connect-client/services"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type UIArgs struct {
	Serve       bool   `help:"Serve the UI and emit its URL on standard output."`
	Interactive bool   `short:"i" help:"Launch a browser to show the interactive UI. Implies --serve."`
	Listen      string `help:"Host:port to listen on."`
	AccessLog   bool   `help:"Log all HTTP requests."`
	TLSKeyFile  string `help:"Path to TLS private key file for the UI server."`
	TLSCertFile string `help:"Path to TLS certificate chain file for the UI server."`
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
	Accounts   *accounts.AccountList
	LocalToken services.LocalToken
	Logger     rslog.Logger `kong:"-"`
}

func NewCLIContext() (*CLIContext, error) {
	logger := rslog.DefaultLogger()
	logger.SetOutput(os.Stderr)
	logger.SetLevel(rslog.DebugLevel)

	accountList := accounts.NewAccountList()
	err := accountList.Load()
	if err != nil {
		return nil, err
	}

	token, err := services.NewLocalToken()
	if err != nil {
		return nil, err
	}

	return &CLIContext{
		Accounts:   accountList,
		LocalToken: token,
		Logger:     logger,
	}, nil
}

// AccountSpec contains the info about a saved account in the account list.
// The user must specify a saved account by name or URL (but not both).
type AccountSpec struct {
	Name    string   `short:"n" xor:"spec" required:"" help:"Nickname of the account to remove."`
	URL     *url.URL `short:"u" xor:"spec" required:"" help:"URL of the server URL to remove."`
	account accounts.Account
}

func (s *AccountSpec) AfterApply(ctx *CLIContext) error {
	// Argument parsing enforces that exactly one of s.Name or s.URL is set
	if s.Name != "" {
		ok, account := ctx.Accounts.GetAccountByName(s.Name)
		if !ok {
			return fmt.Errorf("Account name '%s' is not defined.", s.Name)
		}
		s.account = account
	}
	if s.URL != nil {
		ok, account := ctx.Accounts.GetAccountByURL(s.URL.String())
		if !ok {
			return fmt.Errorf("Server url '%s' is not defined.", s.URL)
		}
		s.account = account
	}
	return nil
}
