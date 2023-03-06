package commands

import (
	"fmt"
	"net/url"
	"os"
	"time"

	"connect-client/api_client/clients"
	"connect-client/apitypes"
	"connect-client/bundles"
	"connect-client/services/proxy"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

// Copyright (C) 2023 by Posit Software, PBC.

type baseBundleCmd struct {
	Exclude   []string `short:"x" help:"list of file patterns to exclude."`
	SourceDir string   `help:"Path to directory containing files to publish." arg:"" type:"existingdir"`
}

type WriteBundleCmd struct {
	baseBundleCmd
	BundleFile string `help:"Path to a file where the bundle should be written." required:"" type:"path"`
}

func (cmd *WriteBundleCmd) Run(args *CommonArgs, ctx *CLIContext) error {
	bundleFile, err := os.Create(cmd.BundleFile)
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	return bundles.NewBundleFromDirectory(cmd.SourceDir, cmd.Exclude, bundleFile, ctx.Logger)
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
	err = bundles.NewBundleFromDirectory(cmd.SourceDir, cmd.Exclude, bundleFile, ctx.Logger)
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
	var previous *clients.Task
	taskLogger := ctx.Logger.WithFields(rslog.Fields{
		"source":     "server deployment log",
		"server":     account.Name,
		"content_id": contentID,
		"bundle_id":  bundleID,
		"task_id":    taskID,
	})
	for {
		task, err := client.GetTask(taskID, previous)
		if err != nil {
			return err
		}
		for _, line := range task.Output {
			taskLogger.Infof("%s", line)
		}
		if task.Finished {
			if task.Error != "" {
				return fmt.Errorf("Error from the server: %s", task.Error)
			}
			break
		}
		time.Sleep(1.0)
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
