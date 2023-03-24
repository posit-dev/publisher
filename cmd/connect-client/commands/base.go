package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/services"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type UIArgs struct {
	Interactive bool   `short:"i" help:"Launch a browser to show the UI."`
	Listen      string `help:"Network address to listen on." placeholder:"HOST[:PORT]"`
	AccessLog   bool   `help:"Log all HTTP requests."`
	TLSKeyFile  string `help:"Path to TLS private key file for the UI server."`
	TLSCertFile string `help:"Path to TLS certificate chain file for the UI server."`
}

type CommonArgs struct {
	Debug debugFlag `help:"Enable debug mode." env:"CONNECT_DEBUG"`
}

type CLIContext struct {
	Accounts   accounts.AccountList
	LocalToken services.LocalToken
	Fs         afero.Fs
	Logger     rslog.Logger
}

func NewCLIContext(accountList accounts.AccountList, token services.LocalToken, fs afero.Fs, logger rslog.Logger) *CLIContext {
	return &CLIContext{
		Accounts:   accountList,
		LocalToken: token,
		Fs:         fs,
		Logger:     logger,
	}
}
