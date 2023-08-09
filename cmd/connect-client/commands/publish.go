package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/publish"
	"github.com/rstudio/connect-client/internal/services/ui"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type StatefulCommand interface {
	LoadState(logger rslog.Logger) error
	SaveState(logger rslog.Logger) error
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
	return "default"
}

func (cmd *BaseBundleCmd) LoadState(logger rslog.Logger) error {
	sourceDir, err := util.DirFromPath(cmd.Path)
	if err != nil {
		return err
	}
	cmd.State.SourceDir = sourceDir
	cmd.Config = cmd.getConfigName()

	cliState := cmd.State
	cmd.State = state.NewDeployment()
	err = cmd.State.LoadManifest(sourceDir, logger)
	if err != nil {
		return err
	}
	if !cmd.New {
		err = cmd.State.LoadFromFiles(sourceDir, cmd.Config, logger)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	cmd.State.Merge(cliState)
	return nil
}

func (cmd *BaseBundleCmd) SaveState(logger rslog.Logger) error {
	return cmd.State.SaveToFiles(cmd.State.SourceDir, cmd.Config, logger)
}

// stateFromCLI takes the CLI options provided by the user,
// performs content auto-detection if needed, and
// updates cmd.State to reflect all of the information.
func (cmd *BaseBundleCmd) stateFromCLI(logger rslog.Logger) error {
	manifest := &cmd.State.Manifest
	manifest.Version = 1
	manifest.Packages = make(bundles.PackageMap)
	manifest.Files = make(bundles.FileMap)

	metadata := &manifest.Metadata
	if metadata.Entrypoint == "" && cmd.Path != cmd.State.SourceDir {
		// Provided path is a file. It is the entrypoint.
		metadata.Entrypoint = cmd.Path.Base()
	}

	if metadata.AppMode == apptypes.UnknownMode || metadata.Entrypoint == "" {
		logger.Infof("Detecting deployment type and entrypoint...")
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
	logger.WithFields(rslog.Fields{
		"Entrypoint": metadata.Entrypoint,
		"AppMode":    metadata.AppMode,
	}).Infof("Deployment type")

	requiresPython, err := cmd.requiresPython()
	if err != nil {
		return err
	}
	if requiresPython {
		err = cmd.inspectPython(logger, manifest)
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

func (cmd *BaseBundleCmd) inspectPython(logger rslog.Logger, manifest *bundles.Manifest) error {
	inspector := environment.NewPythonInspector(cmd.State.SourceDir, cmd.Python, logger)
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

type CreateBundleCmd struct {
	*BaseBundleCmd `kong:"embed"`
	BundleFile     util.Path `help:"Path to a file where the bundle should be written." kong:"required"`
}

func (cmd *CreateBundleCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.Context) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	return publish.CreateBundle(&cmd.PublishArgs, cmd.BundleFile, ctx.Logger)
}

type WriteManifestCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

func (cmd *WriteManifestCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.Context) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	return publish.WriteManifest(&cmd.PublishArgs, ctx.Logger)
}

type PublishCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

func (cmd *PublishCmd) Run(args *cli_types.CommonArgs, ctx *cli_types.Context) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	return publish.Publish(&cmd.PublishArgs, ctx.Accounts, ctx.Logger)
}

type PublishUICmd struct {
	PublishCmd `kong:"embed"`
	ui         cli_types.UIArgs
}

func (cmd *PublishUICmd) Run(args *cli_types.CommonArgs, ctx *cli_types.Context) error {
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	svc := ui.NewUIService(
		"/",
		cmd.ui,
		&cmd.PublishArgs,
		ctx.LocalToken,
		ctx.Fs,
		ctx.Accounts,
		ctx.Logger)
	return svc.Run()
}
