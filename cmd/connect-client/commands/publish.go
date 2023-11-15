package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/services/ui"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

var errNoAccounts = errors.New("There are no accounts yet. Register an account before publishing.")

// getDefaultAccount returns the name of the default account,
// which is the first Connect account alphabetically by name.
func getDefaultAccount(accounts []accounts.Account) (*accounts.Account, error) {
	if len(accounts) == 0 {
		return nil, errNoAccounts
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return &accounts[0], nil
}

// stateFromCLI takes the CLI options provided by the user,
// performs content auto-detection if needed, and
// updates cmd.State to reflect all of the information.
func (cmd *InitCommand) stateFromCLI(log logging.Logger) error {
	manifest := &cmd.State.Manifest
	manifest.Version = 1
	manifest.Packages = make(bundles.PackageMap)

	metadata := &manifest.Metadata
	if metadata.Entrypoint == "" && cmd.Path != cmd.State.SourceDir {
		// Provided path is a file. It is the entrypoint.
		metadata.Entrypoint = cmd.Path.Base()
	}

	if metadata.AppMode == apptypes.UnknownMode || metadata.Entrypoint == "" {
		log.Info("Detecting deployment type and entrypoint...")
		typeDetector := inspect.NewContentTypeDetector()
		contentType, err := typeDetector.InferType(cmd.Path)
		if err != nil {
			return fmt.Errorf("error detecting content type: %w", err)
		}
		// User-provided values override auto detection
		if metadata.AppMode == apptypes.UnknownMode {
			metadata.AppMode = contentType.AppMode
		}
		if metadata.Entrypoint == "" {
			metadata.Entrypoint = contentType.Entrypoint
		}
	}
	switch metadata.AppMode {
	case apptypes.StaticMode:
		metadata.PrimaryHtml = metadata.Entrypoint
	case apptypes.StaticRmdMode, apptypes.ShinyRmdMode:
		metadata.PrimaryRmd = metadata.Entrypoint
	}
	log.Info("Deployment type", "Entrypoint", metadata.Entrypoint, "AppMode", metadata.AppMode)

	initCommand := InitCommand{
		State: cmd.State,
	}
	pythonRequired, err := initCommand.requiresPython()
	if err != nil {
		return err
	}
	if pythonRequired {
		initCommand.inspectPython(log, manifest)
	}

	manifest.ResetEmptyFields()
	return nil
}

// This is an incomplete implementation of InitCommand,
// created as a place to put the inspection code that was
// previously part of BaseBundleCmd.
type InitCommand struct {
	Path   util.Path         `help:"Path to directory containing files to publish." arg:"" default:"."`
	Python util.Path         `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	State  *state.Deployment `kong:"-"`
}

func (cmd *InitCommand) requiresPython() (bool, error) {
	manifest := &cmd.State.Manifest
	if manifest.Metadata.AppMode.IsPythonContent() {
		return true, nil
	}
	if cmd.Python.Path() != "" {
		return true, nil
	}
	if manifest.Python != nil && manifest.Python.Version != "" {
		return true, nil
	}
	// Presence of requirements.txt implies Python is needed.
	// This is the preferred approach since it is unambiguous and
	// doesn't rely on environment inspection.
	requirementsPath := cmd.State.SourceDir.Join(bundles.PythonRequirementsFilename)
	exists, err := requirementsPath.Exists()
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (cmd *InitCommand) inspectPython(log logging.Logger, manifest *bundles.Manifest) error {
	inspector := environment.NewPythonInspector(cmd.State.SourceDir, cmd.Python, log)
	if manifest.Python.Version == "" {
		pythonVersion, err := inspector.GetPythonVersion()
		if err != nil {
			return err
		}
		manifest.Python.Version = pythonVersion
	}
	packages, err := inspector.GetPythonRequirements()
	if err != nil {
		return err
	}
	manifest.Python.PackageManager = bundles.PythonPackageManager{
		Name:        "pip",
		PackageFile: bundles.PythonRequirementsFilename,
	}
	// Package list will be written to requirements.txt in the bundle, if not already present.
	cmd.State.PythonRequirements = packages
	return nil
}

func (cmd *InitCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	requiresPython, err := cmd.requiresPython()
	if err != nil {
		return err
	}
	if requiresPython {
		err = cmd.inspectPython(ctx.Logger, &cmd.State.Manifest)
		if err != nil {
			return err
		}
	}
	return nil
}

type PublishCmd struct {
	Path        util.Path          `help:"Path to directory containing files to publish." arg:"" default:"."`
	AccountName string             `short:"n" help:"Nickname of destination publishing account."`
	ConfigName  string             `kong:"config" short:"c" help:"Configuration name (in .posit/publish/)"`
	TargetName  string             `kong:"update" short:"u" help:"Name of deployment to update (in .posit/deployments/)"`
	Account     *accounts.Account  `kong:"-"`
	Config      *config.Config     `kong:"-"`
	Target      *config.Deployment `kong:"-"`
}

func (cmd *PublishCmd) LoadConfig() (*config.Config, error) {
	if !strings.HasSuffix(cmd.ConfigName, ".toml") {
		cmd.ConfigName += ".toml"
	}
	configPath := cmd.Path.Join(".posit", "publish", cmd.ConfigName)
	cfg, err := config.ReadOrCreateConfigFile(configPath)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func (cmd *PublishCmd) LoadTarget() (*config.Deployment, error) {
	if !strings.HasSuffix(cmd.TargetName, ".toml") {
		cmd.TargetName += ".toml"
	}
	configPath := cmd.Path.Join(".posit", "deployments", cmd.TargetName)
	target, err := config.ReadDeploymentFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("can't find deployment at '%s'", configPath)
		}
		return nil, err
	}
	return target, nil
}

var errNoDefaultAccount = errors.New("you have more than one publishing account; you must specify one with --account")

func (cmd *PublishCmd) LoadAccount(accountList accounts.AccountList) (*accounts.Account, error) {
	if cmd.AccountName == "" {
		accounts, err := accountList.GetAllAccounts()
		if err != nil {
			return nil, err
		}
		account, err := getDefaultAccount(accounts)
		if err != nil {
			return nil, err
		}
		return account, nil
	} else {
		account, err := accountList.GetAccountByName(cmd.AccountName)
		if err != nil {
			return nil, err
		}
		return account, nil
	}
}

var errTargetImpliesConfig = errors.New("cannot specify --config with --target")
var errTargetImpliesAccount = errors.New("cannot specify --account with --target")

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	var target *config.Deployment
	var account *accounts.Account
	var cfg *config.Config
	var err error

	if cmd.TargetName != "" {
		// Specifying an existing deployment determines
		// the account and configuration.
		// TODO: see if this can be done with a Kong group.
		if cmd.ConfigName != "" {
			return errTargetImpliesConfig
		}
		if cmd.AccountName != "" {
			return errTargetImpliesAccount
		}
		target, err = cmd.LoadTarget()
		if err != nil {
			return err
		}

		// Target specifies the configuration name
		cmd.ConfigName = target.ConfigurationFile

		// and the account's server URL
		account, err = ctx.Accounts.GetAccountByServerURL(target.ServerURL)
		if err != nil {
			return err
		}
		cmd.AccountName = account.Name
	} else {
		// Use specified account, or default account
		account, err = cmd.LoadAccount(ctx.Accounts)
		if err != nil {
			return err
		}
	}
	cfg, err = cmd.LoadConfig()
	if err != nil {
		return err
	}
	publisher := publish.New(cmd.Path, account, cfg, target)
	return publisher.PublishDirectory(ctx.Logger)
}

type PublishUICmd struct {
	Path          util.Path `help:"Path to directory containing files to publish." arg:"" default:"."`
	Interactive   bool      `short:"i" help:"Launch a browser to show the UI at the listen address."`
	OpenBrowserAt string    `help:"Launch a browser to show the UI at specific network address." placeholder:"HOST[:PORT]" hidden:""`
	Theme         string    `help:"UI theme, 'light' or 'dark'." hidden:""`
	Listen        string    `help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`
	AccessLog     bool      `help:"Log all HTTP requests."`
	TLSKeyFile    string    `help:"Path to TLS private key file for the UI server."`
	TLSCertFile   string    `help:"Path to TLS certificate chain file for the UI server."`
}

func (cmd *PublishUICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	eventServer := sse.New()
	eventServer.CreateStream("messages")

	log := events.NewLoggerWithSSE(args.Debug, eventServer)
	svc := ui.NewUIService(
		"/",
		cmd.Interactive,
		cmd.OpenBrowserAt,
		cmd.Theme,
		cmd.Listen,
		cmd.AccessLog,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Path,
		ctx.Fs,
		ctx.Accounts,
		log,
		eventServer)
	return svc.Run()
}
