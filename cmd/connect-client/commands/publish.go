package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"

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
	Path   util.Path            `help:"Path to directory containing files to publish." arg:"" default:"."`
	Python util.Path            `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	State  *state.OldDeployment `kong:"-"`
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
	TargetID    string             `kong:"update" short:"u" help:"ID of deployment to update (in .posit/deployments/)"`
	Account     *accounts.Account  `kong:"-"`
	Config      *config.Config     `kong:"-"`
	Target      *config.Deployment `kong:"-"`
}

var errTargetImpliesConfig = errors.New("cannot specify --config with --target")
var errTargetImpliesAccount = errors.New("cannot specify --account with --target")

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	publisher, err := publish.New(cmd.Path, cmd.AccountName, cmd.ConfigName, cmd.TargetID, ctx.Accounts)
	if err != nil {
		return err
	}
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
	stateStore, err := state.New(cmd.Path, "", "default.toml", "", ctx.Accounts)
	if err != nil {
		return err
	}

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
		stateStore,
		ctx.Accounts,
		log,
		eventServer)
	return svc.Run()
}
