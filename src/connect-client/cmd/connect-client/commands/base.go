package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"connect-client/accounts"
	"connect-client/services"
	"connect-client/services/ui"

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

func RunUI(fragment string, args *CommonArgs, ctx *CLIContext) error {
	svc := ui.NewUIService(
		fragment,
		args.Listen,
		args.TLSKeyFile,
		args.TLSCertFile,
		args.Interactive,
		args.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
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

func NewCLIContext(logger rslog.Logger) (*CLIContext, error) {
	accountList := accounts.NewAccountList(logger)
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
