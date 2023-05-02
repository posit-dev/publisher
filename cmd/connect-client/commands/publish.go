package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/rstudio/connect-client/internal/api_client/clients"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/services/proxy"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type BaseBundleCmd struct {
	Python      string   `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	Exclude     []string `short:"x" help:"list of file patterns to exclude."`
	Path        string   `help:"Path to directory containing files to publish, or a file within that directory." arg:""`
	Config      string   `help:"Name of metadata directory to load/save (see ./.posit/deployments/)."`
	AccountName string   `short:"n" help:"Nickname of destination publishing account."`
	// Store for the deployment State that will be served to the UI,
	// published, written to manifest and metadata files, etc.
	State *state.Deployment `kong:"embed"`
}

type StatefulCommand interface {
	GetState() *state.Deployment
	SetState(s *state.Deployment)
	GetBaseCmd() *BaseBundleCmd
}

func (cmd *BaseBundleCmd) GetState() *state.Deployment {
	return cmd.State
}

func (cmd *BaseBundleCmd) SetState(s *state.Deployment) {
	cmd.State = s
}

func (cmd *BaseBundleCmd) GetBaseCmd() *BaseBundleCmd {
	return cmd
}

// stateFromCLI takes the CLI options provided by the user,
// performs content auto-detection if needed, and produces
// updates cmd.State to reflect all of the information.
func (cmd *BaseBundleCmd) stateFromCLI(fs afero.Fs, logger rslog.Logger) error {
	sourceDir, err := util.DirFromPath(fs, cmd.Path)
	if err != nil {
		return err
	}
	cmd.State.SourceDir = sourceDir
	manifest := &cmd.State.Manifest
	manifest.Version = 1
	manifest.Packages = make(bundles.PackageMap)
	manifest.Files = make(bundles.FileMap)

	metadata := &manifest.Metadata
	if metadata.Entrypoint == "" && cmd.Path != sourceDir {
		// Provided path is a file. It is the entrypoint.
		metadata.Entrypoint = filepath.Base(cmd.Path)
	}

	if metadata.AppMode == apptypes.UnknownMode || metadata.Entrypoint == "" {
		logger.Infof("Detecting deployment type and entrypoint...")
		typeDetector := inspect.NewContentTypeDetector()
		contentType, err := typeDetector.InferType(fs, cmd.Path)
		if err != nil {
			return fmt.Errorf("Error detecting content type: %w", err)
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

	requiresPython, err := cmd.requiresPython(fs)
	if err != nil {
		return err
	}
	if requiresPython {
		err = cmd.inspectPython(fs, logger, manifest)
		if err != nil {
			return err
		}
	}
	manifest.ResetEmptyFields()
	return nil
}

func (cmd *BaseBundleCmd) requiresPython(fs afero.Fs) (bool, error) {
	manifest := &cmd.State.Manifest
	if manifest.Metadata.AppMode.IsPythonContent() {
		return true, nil
	}
	if cmd.Python != "" {
		return true, nil
	}
	if manifest.Python != nil && manifest.Python.Version != "" {
		return true, nil
	}
	// Presence of requirements.txt implies Python is needed.
	// This is the preferred approach since it is unambiguous and
	// doesn't rely on environment inspection.
	requirementsPath := filepath.Join(cmd.State.SourceDir, bundles.PythonRequirementsFilename)
	exists, err := afero.Exists(fs, requirementsPath)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (cmd *BaseBundleCmd) inspectPython(fs afero.Fs, logger rslog.Logger, manifest *bundles.Manifest) error {
	inspector := environment.NewPythonInspector(fs, cmd.State.SourceDir, cmd.Python, logger)
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
	BundleFile     string `help:"Path to a file where the bundle should be written." required:"" type:"path"`
}

func (cmd *CreateBundleCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	bundleFile, err := os.Create(cmd.BundleFile)
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	err = cmd.stateFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	return err
}

type WriteManifestCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

func (cmd *WriteManifestCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	err := cmd.stateFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
	if err != nil {
		return err
	}
	manifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	manifestPath := filepath.Join(cmd.State.SourceDir, bundles.ManifestFilename)
	ctx.Logger.Infof("Writing manifest to '%s'", manifestPath)
	manifestJSON, err := manifest.ToJSON()
	if err != nil {
		return err
	}
	err = os.WriteFile(manifestPath, manifestJSON, 0666)
	if err != nil {
		return fmt.Errorf("Error writing manifest file '%s': %w", manifestPath, err)
	}
	return nil
}

type PublishCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.AccountName)
	if err != nil {
		return err
	}
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()

	err = cmd.stateFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	bundleFile.Seek(0, os.SEEK_SET)

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := clients.NewConnectClient(account, 2*time.Minute, ctx.Logger)
	if err != nil {
		return err
	}
	// TODO: redeployment option
	contentID, err := client.CreateDeployment(cmd.State.Connect.Content)
	if err != nil {
		return err
	}
	bundleID, err := client.UploadBundle(contentID, bundleFile)
	if err != nil {
		return err
	}

	cmd.State.Target = state.TargetID{
		ServerType:  account.ServerType,
		ServerName:  account.Name,
		ServerURL:   account.URL,
		ContentId:   apitypes.NewOptional(contentID),
		ContentName: "",
		Username:    account.AccountName,
		BundleId:    apitypes.NewOptional(bundleID),
		DeployedAt:  apitypes.NewOptional(time.Now()),
	}

	taskID, err := client.DeployBundle(contentID, bundleID)
	if err != nil {
		return err
	}
	taskLogger := ctx.Logger.WithFields(rslog.Fields{
		"source":     "server deployment log",
		"server":     account.URL,
		"content_id": contentID,
		"bundle_id":  bundleID,
		"task_id":    taskID,
	})
	err = client.WaitForTask(taskID, util.NewLoggerWriter(taskLogger))
	if err != nil {
		return err
	}
	return nil
}

type PublishUICmd struct {
	UIArgs
	PublishCmd
}

func (cmd *PublishUICmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.AccountName)
	if err != nil {
		return err
	}
	serverURL, err := url.Parse(account.URL)
	if err != nil {
		return err
	}
	svc := proxy.NewProxyService(
		cmd.AccountName,
		serverURL,
		cmd.Listen,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Interactive,
		cmd.AccessLog,
		ctx.LocalToken,
		ctx.Logger)
	return svc.Run()
}
