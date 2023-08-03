package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/rstudio/connect-client/internal/api_client/clients"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/services/ui"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type BaseBundleCmd struct {
	Python  util.Path `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	Exclude []string  `short:"x" help:"list of file patterns to exclude."`
	Path    util.Path `help:"Path to directory containing files to publish, or a file within that directory." arg:""`
	Config  string    `help:"Name of metadata directory to load/save (see ./.posit/deployments/)."`
	New     bool      `help:"Create a new deployment instead of updating the previous deployment."`
	// Store for the deployment State that will be served to the UI,
	// published, written to manifest and metadata files, etc.
	State *state.Deployment `kong:"embed"`
}

type StatefulCommand interface {
	LoadState(logger rslog.Logger) error
	SaveState(logger rslog.Logger) error
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

func (cmd *CreateBundleCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	bundleFile, err := cmd.BundleFile.Create()
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	err = cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
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
	err := cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
	if err != nil {
		return err
	}
	manifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	manifestPath := cmd.State.SourceDir.Join(bundles.ManifestFilename)
	ctx.Logger.Infof("Writing manifest to '%s'", manifestPath)
	manifestJSON, err := manifest.ToJSON()
	if err != nil {
		return err
	}
	err = manifestPath.WriteFile(manifestJSON, 0666)
	if err != nil {
		return fmt.Errorf("error writing manifest file '%s': %w", manifestPath, err)
	}
	return nil
}

type PublishCmd struct {
	*BaseBundleCmd `kong:"embed"`
}

type appInfo struct {
	DashboardURL string `json:"dashboard-url"`
	DirectURL    string `json:"direct-url"`
}

func logAppInfo(accountURL string, contentID apitypes.ContentID, logger rslog.Logger) error {
	appInfo := appInfo{
		DashboardURL: fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID),
		DirectURL:    fmt.Sprintf("%s/content/%s", accountURL, contentID),
	}
	logger.WithFields(rslog.Fields{
		"dashboardURL": appInfo.DashboardURL,
		"directURL":    appInfo.DirectURL,
		"serverURL":    accountURL,
		"contentID":    contentID,
	}).Infof("Deployment successful")
	jsonInfo, err := json.Marshal(appInfo)
	if err != nil {
		return err
	}
	_, err = fmt.Printf("%s\n", jsonInfo)
	return err
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.State.Target.AccountName)
	if err != nil {
		return err
	}
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()

	err = cmd.stateFromCLI(ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(cmd.Path, &cmd.State.Manifest, cmd.Exclude, nil, ctx.Logger)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	if err != nil {
		return err
	}
	bundleFile.Seek(0, io.SeekStart)

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := clients.NewConnectClient(account, 2*time.Minute, ctx.Logger)
	if err != nil {
		return err
	}

	var contentID apitypes.ContentID
	if cmd.State.Target.ContentId != "" && !cmd.New {
		contentID = cmd.State.Target.ContentId
		err = client.UpdateDeployment(contentID, cmd.State.Connect.Content)
		if err != nil {
			httpErr, ok := err.(*clients.HTTPError)
			if ok && httpErr.Code == http.StatusNotFound {
				return fmt.Errorf("saved deployment with id %s cound not be found. Redeploying with --new will create a new deployment and discard the old saved metadata", contentID)
			}
			return err
		}
	} else {
		contentID, err = client.CreateDeployment(cmd.State.Connect.Content)
		if err != nil {
			return err
		}
	}
	bundleID, err := client.UploadBundle(contentID, bundleFile)
	if err != nil {
		return err
	}

	cmd.State.Target = state.TargetID{
		ServerType:  account.ServerType,
		AccountName: account.Name,
		ServerURL:   account.URL,
		ContentId:   contentID,
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
	return logAppInfo(account.URL, contentID, ctx.Logger)
}

type PublishUICmd struct {
	UIArgs
	PublishCmd
}

func (cmd *PublishUICmd) Run(args *CommonArgs, ctx *CLIContext) error {
	svc := ui.NewUIService(
		"/",
		cmd.Listen,
		cmd.TLSKeyFile,
		cmd.TLSCertFile,
		cmd.Interactive,
		cmd.OpenBrowserAt,
		cmd.SkipBrowserSessionAuth,
		cmd.AccessLog,
		ctx.LocalToken,
		ctx.Fs,
		ctx.Logger)
	return svc.Run()
}
