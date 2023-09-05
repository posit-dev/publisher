package cli_types

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/services"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"

	"github.com/spf13/afero"
)

type CommonArgs struct {
	Debug bool                 `help:"Enable debug mode." env:"CONNECT_DEBUG"`
	Token *services.LocalToken `help:"Authentication token for the publishing UI. Default auto-generates a token."`
}

type Log interface {
	logging.Logger
}

type CLIContext struct {
	Accounts   accounts.AccountList
	LocalToken services.LocalToken
	Fs         afero.Fs
	Logger     logging.Logger
}

func NewCLIContext(accountList accounts.AccountList, token services.LocalToken, fs afero.Fs, log logging.Logger) *CLIContext {
	return &CLIContext{
		Accounts:   accountList,
		LocalToken: token,
		Fs:         fs,
		Logger:     log,
	}
}

type UIArgs struct {
	Interactive            bool   `short:"i" help:"Launch a browser to show the UI at the listen address."`
	OpenBrowserAt          string `help:"Launch a browser to show the UI at specific network address." placeholder:"HOST[:PORT]" hidden:""`
	SkipBrowserSessionAuth bool   `help:"Skip Browser Token Auth Checks" hidden:""`
	Listen                 string `help:"Network address to listen on." placeholder:"HOST[:PORT]"`
	AccessLog              bool   `help:"Log all HTTP requests."`
	TLSKeyFile             string `help:"Path to TLS private key file for the UI server."`
	TLSCertFile            string `help:"Path to TLS certificate chain file for the UI server."`
}

type PublishArgs struct {
	Python  util.Path `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	Exclude []string  `short:"x" help:"list of file patterns to exclude."`
	Path    util.Path `help:"Path to directory containing files to publish, or a file within that directory." arg:""`
	Config  string    `help:"Name of metadata directory to load/save (see ./.posit/deployments/)."`
	New     bool      `help:"Create a new deployment instead of updating the previous deployment."`
	// Store for the deployment State that will be served to the UI,
	// published, written to manifest and metadata files, etc.
	State *state.Deployment `kong:"embed"`
}
