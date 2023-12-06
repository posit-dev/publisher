package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"

	"github.com/spf13/afero"
)

type CommonArgs struct {
	Verbose int    `short:"v" type:"counter" help:"Enable verbose logging. Use -vv for debug logging."`
	Profile string `help:"Enable CPU profiling" kong:"hidden"`
}

type Log interface {
	logging.Logger
}

type CLIContext struct {
	Accounts accounts.AccountList
	Fs       afero.Fs
	Logger   logging.Logger
}

func NewCLIContext(accountList accounts.AccountList, fs afero.Fs, log logging.Logger) *CLIContext {
	return &CLIContext{
		Accounts: accountList,
		Fs:       fs,
		Logger:   log,
	}
}
