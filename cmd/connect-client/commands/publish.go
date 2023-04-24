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
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type baseBundleCmd struct {
	ContentType   string   `short:"t" help:"Type of content being deployed. Default is to auto detect."`
	Entrypoint    string   `help:"Entrypoint for the application. Usually it is the filename of the primary file. For Python Flask and FastAPI, it can be of the form module:object."`
	Python        string   `help:"Path to Python interpreter for this content. Required unless you specify --python-version and include a requirements.txt file. Default is the Python 3 on your PATH."`
	PythonVersion string   `help:"Version of Python required by this content. Default is the version of Python 3 on your PATH."`
	Exclude       []string `short:"x" help:"list of file patterns to exclude."`
	Path          string   `help:"Path to directory containing files to publish, or a file within that directory." arg:""`
}

// contentTypeFromCLI takes the CLI options provided by the user,
// performs content auto-detection if needed, and produces
// a ContentType describing the deployment.
func (cmd *baseBundleCmd) contentTypeFromCLI(fs afero.Fs, logger rslog.Logger) (*inspect.ContentType, error) {
	appMode, err := apptypes.AppModeFromString(cmd.ContentType)
	if err != nil {
		return nil, err
	}
	entrypoint := cmd.Entrypoint
	if entrypoint == "" {
		isDir, err := afero.IsDir(fs, cmd.Path)
		if err != nil {
			return nil, err
		}
		if !isDir {
			entrypoint = filepath.Base(cmd.Path)
		}
	}
	contentType := &inspect.ContentType{}
	if appMode == apptypes.UnknownMode || entrypoint == "" {
		logger.Infof("Detecting deployment type...")
		typeDetector := inspect.NewContentTypeDetector()
		contentType, err = typeDetector.InferType(fs, cmd.Path)
		if err != nil {
			return nil, fmt.Errorf("Error detecting content type: %w", err)
		}
	}
	// User-provided values override auto detection
	if appMode != "" {
		contentType.AppMode = appMode
	}
	if entrypoint != "" {
		contentType.Entrypoint = entrypoint
	}
	if cmd.PythonVersion != "" || appMode.IsPythonContent() {
		contentType.RequiresPython = true
	}
	logger.WithFields(rslog.Fields{
		"Entrypoint": contentType.Entrypoint,
		"AppMode":    contentType.AppMode,
	}).Infof("Deployment type")
	return contentType, nil
}

// manifestFromCLI takes the CLI options provided by the user
// and produces a stub manifest containing the deployment metadata.
// The Files section will be empty, to be filled in by the Bundler.
func (cmd *baseBundleCmd) manifestFromCLI(fs afero.Fs, logger rslog.Logger) (*bundles.Manifest, error) {
	manifest := bundles.NewManifest()
	contentType, err := cmd.contentTypeFromCLI(fs, logger)
	if err != nil {
		return nil, err
	}
	manifest.Metadata.AppMode = contentType.AppMode
	manifest.Metadata.EntryPoint = contentType.Entrypoint

	switch contentType.AppMode {
	case apptypes.StaticMode:
		manifest.Metadata.PrimaryHtml = contentType.Entrypoint
	case apptypes.StaticRmdMode, apptypes.ShinyRmdMode:
		manifest.Metadata.PrimaryRmd = contentType.Entrypoint
	}
	if contentType.RequiresPython {
		isDir, err := afero.IsDir(fs, cmd.Path)
		if err != nil {
			return nil, err
		}
		var projectDir string
		if isDir {
			projectDir = cmd.Path
		} else {
			projectDir = filepath.Dir(cmd.Path)
		}
		inspector := environment.NewPythonInspector(fs, projectDir, cmd.Python, cmd.PythonVersion, logger)
		pythonVersion, err := inspector.GetPythonVersion()
		if err != nil {
			return nil, err
		}
		packages, err := inspector.GetPythonRequirements()
		if err != nil {
			return nil, err
		}
		manifest.Python = &bundles.Python{
			Version: pythonVersion,
			PackageManager: bundles.PythonPackageManager{
				Name:        "pip",
				PackageFile: "requirements.txt",
				Packages:    packages, // will be written to requirements.txt in the bundle
			},
		}
	}
	return manifest, nil
}

type CreateBundleCmd struct {
	baseBundleCmd
	BundleFile string `help:"Path to a file where the bundle should be written." required:"" type:"path"`
}

func (cmd *CreateBundleCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	bundleFile, err := os.Create(cmd.BundleFile)
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	baseManifest, err := cmd.manifestFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, baseManifest, cmd.Exclude, ctx.Logger)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	return err
}

type WriteManifestCmd struct {
	baseBundleCmd
}

func (cmd *WriteManifestCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	baseManifest, err := cmd.manifestFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, baseManifest, cmd.Exclude, ctx.Logger)
	if err != nil {
		return err
	}
	manifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	manifestPath := filepath.Join(cmd.Path, bundles.ManifestFilename)
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
	baseBundleCmd
	Name string `short:"n" help:"Nickname of destination publishing account."`
}

func (cmd *PublishCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	account, err := ctx.Accounts.GetAccountByName(cmd.Name)
	if err != nil {
		return err
	}
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()

	baseManifest, err := cmd.manifestFromCLI(ctx.Fs, ctx.Logger)
	if err != nil {
		return err
	}
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, baseManifest, cmd.Exclude, ctx.Logger)
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
	// TODO: name and title
	// TODO: redeployment option
	contentID, err := client.CreateDeployment("", apitypes.NullString{})
	if err != nil {
		return err
	}
	bundleID, err := client.UploadBundle(contentID, bundleFile)
	if err != nil {
		return err
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
	account, err := ctx.Accounts.GetAccountByName(cmd.Name)
	if err != nil {
		return err
	}
	serverURL, err := url.Parse(account.URL)
	if err != nil {
		return err
	}
	svc := proxy.NewProxyService(
		cmd.Name,
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
