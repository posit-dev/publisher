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
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/services/proxy"
	"github.com/rstudio/connect-client/internal/util"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type baseBundleCmd struct {
	ContentType string   `short:"t" help:"Type of content being deployed. Default is to auto detect."`
	Entrypoint  string   `help:"Entrypoint for the application. Usually it is the filename of the primary file. For Python Flask and FastAPI, it can be of the form module:object."`
	Exclude     []string `short:"x" help:"list of file patterns to exclude."`
	Path        string   `help:"Path to directory containing files to publish, or a file within that directory." arg:""`
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
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, cmd.Entrypoint, cmd.ContentType, cmd.Exclude, ctx.Logger)
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
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, cmd.Entrypoint, cmd.ContentType, cmd.Exclude, ctx.Logger)
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
	bundler, err := bundles.NewBundler(ctx.Fs, cmd.Path, cmd.Entrypoint, cmd.ContentType, cmd.Exclude, ctx.Logger)
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
