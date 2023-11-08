package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"os"
	"sort"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/services/ui"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

type StatefulCommand interface {
	LoadState(ctx *cli_types.CLIContext) error
	SaveState(ctx *cli_types.CLIContext) error
}

type BaseBundleCmd struct {
	cli_types.PublishArgs
}

func (cmd *BaseBundleCmd) getConfigName() string {
	if cmd.Config != "" {
		return cmd.Config
	}
	if cmd.State.Target.AccountName != "" {
		return cmd.State.Target.AccountName
	}
	return ""
}

func (cmd *BaseBundleCmd) LoadState(ctx *cli_types.CLIContext) error {
	log := ctx.Logger
	sourceDir, err := util.DirFromPath(cmd.Path)
	if err != nil {
		return err
	}
	cmd.State.SourceDir = sourceDir
	cmd.Config = cmd.getConfigName()

	cliState := cmd.State
	if cmd.New {
		cmd.State = state.NewDeployment()
	} else {
		if cmd.Config != "" {
			// Config name provided, use that saved metadata.
			log.Info("Attempting to load metadata for selected account/configuration",
				"name", cmd.Config)
			err = cmd.State.LoadFromFiles(sourceDir, cmd.Config, log)
			if err != nil && !os.IsNotExist(err) {
				return err
			}
		} else {
			// No config or account name provided. Use the most recent deployment.
			log.Info("Attempting to load metadata for most recent deployment target")
			cmd.State, err = state.GetMostRecentDeployment(cmd.State.SourceDir, log)
			if err != nil {
				return err
			}
			// No saved metadata found. Use the default account.
			if cmd.State != nil {
				log.Info("Loaded most recent deployment",
					"name", cmd.State.Target.AccountName)
			} else {
				cmd.State = state.NewDeployment()
				accounts, err := ctx.Accounts.GetAccountsByServerType(accounts.ServerTypeConnect)
				if err != nil {
					return err
				}
				cmd.State.Target.AccountName = getDefaultAccount(accounts)
				log.Info("No saved metadata found; using the default account.",
					"name", cmd.State.Target.AccountName)
			}
		}
	}
	// Target account name may have changed.
	cmd.Config = cmd.getConfigName()
	cmd.State.Merge(cliState)
	return nil
}

func (cmd *BaseBundleCmd) SaveState(ctx *cli_types.CLIContext) error {
	return cmd.State.SaveToFiles(cmd.State.SourceDir, cmd.Config, ctx.Logger)
}

func createManifestFileMapFromSourceDir(sourceDir util.Path, log logging.Logger) (bundles.ManifestFileMap, error) {
	files := make(bundles.ManifestFileMap)

	ignore, err := gitignore.NewIgnoreList(sourceDir, nil)
	if err != nil {
		return nil, err
	}

	// grab the absolute path for use in file tree walk
	root, err := sourceDir.Abs()
	if err != nil {
		return nil, err
	}

	walker := util.NewSymlinkWalker(ignore, log)
	err = walker.Walk(root, func(path util.Path, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// assume the paths listed in the manifest are relative
		//
		// a future improvement can ask the user for preference on file listing
		// if this occurs, downstream references to this value must be changed to
		// recognize non-relative paths
		rel, err := path.Rel(root)
		if err != nil {
			return err
		}

		// use the relative file path when creating the manifest
		files[rel.Path()] = bundles.NewManifestFile()
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// getDefaultAccount returns the name of the default account,
// which is the first Connect account alphabetically by name.
func getDefaultAccount(accounts []accounts.Account) string {
	if len(accounts) == 0 {
		return ""
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return accounts[0].Name
}

// stateFromCLI takes the CLI options provided by the user,
// performs content auto-detection if needed, and
// updates cmd.State to reflect all of the information.
func (cmd *BaseBundleCmd) stateFromCLI(log logging.Logger) error {
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

	manifestFiles, err := createManifestFileMapFromSourceDir(cmd.State.SourceDir, log)
	if err != nil {
		return err
	}
	manifest.Files = manifestFiles

	requiresPython, err := cmd.requiresPython()
	if err != nil {
		return err
	}
	if requiresPython {
		err = cmd.inspectPython(log, manifest)
		if err != nil {
			return err
		}
	}
	manifest.ResetEmptyFields()
	return nil
}

func (cmd *BaseBundleCmd) requiresPython() (bool, error) {
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

func (cmd *BaseBundleCmd) inspectPython(log logging.Logger, manifest *bundles.Manifest) error {
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

type PublishCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	publisher := publish.New(&cmd.PublishArgs)
	return publisher.PublishDirectory(ctx.Accounts, ctx.Logger)
}

type PublishUICmd struct {
	PublishCmd `kong:"embed"`
	cli_types.UIArgs
}

func (cmd *PublishUICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	eventServer := sse.New()
	eventServer.CreateStream("messages")

	log := events.NewLoggerWithSSE(args.Debug, eventServer)
	svc := ui.NewUIService(
		"/",
		cmd.UIArgs,
		&cmd.PublishArgs,
		ctx.LocalToken,
		ctx.Fs,
		ctx.Accounts,
		log,
		eventServer)
	return svc.Run()
}
