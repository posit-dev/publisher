package commands

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"connect-client/api_client/clients"
	"connect-client/apitypes"
	"connect-client/bundles"
	"connect-client/services/proxy"
	"connect-client/util"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

type baseBundleCmd struct {
	Exclude   []string `short:"x" help:"list of file patterns to exclude."`
	SourceDir string   `help:"Path to directory containing files to publish." arg:"" type:"existingdir"`
}

func (cmd *baseBundleCmd) makeWalker() (bundles.Walker, error) {
	walker, err := bundles.NewDefaultWalker(cmd.SourceDir, cmd.Exclude)
	if err != nil {
		return nil, fmt.Errorf("Error loading ignore list: %w", err)
	}
	return walker, nil
}

type CreateBundleCmd struct {
	baseBundleCmd
	BundleFile string `help:"Path to a file where the bundle should be written." required:"" type:"path"`
}

func (cmd *CreateBundleCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	walker, err := cmd.makeWalker()
	if err != nil {
		return err
	}
	bundleFile, err := os.Create(cmd.BundleFile)
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	_, err = bundles.NewBundleFromDirectory(cmd.SourceDir, walker, bundleFile, ctx.Logger)
	if err != nil {
		return err
	}
	return nil
}

type WriteManifestCmd struct {
	baseBundleCmd
}

func (cmd *WriteManifestCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	walker, err := cmd.makeWalker()
	if err != nil {
		return err
	}
	manifest, err := bundles.NewBundleFromDirectory(cmd.SourceDir, walker, nil, ctx.Logger)
	if err != nil {
		return err
	}
	manifestPath := filepath.Join(cmd.SourceDir, bundles.ManifestFilename)
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
	walker, err := cmd.makeWalker()
	if err != nil {
		return err
	}
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()
	_, err = bundles.NewBundleFromDirectory(cmd.SourceDir, walker, bundleFile, ctx.Logger)
	if err != nil {
		return err
	}
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
		"server":     account.Name,
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
