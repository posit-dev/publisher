package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/api_client/clients"
	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/util"
)

func CreateBundleFromDirectory(cmd *cli_types.PublishArgs, dest util.Path, log events.Logger) error {
	bundleFile, err := dest.Create()
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	bundler, err := bundles.NewBundler(cmd.State.SourceDir, &cmd.State.Manifest, cmd.Exclude, nil, log)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	return err
}

func WriteManifestFromDirectory(cmd *cli_types.PublishArgs, log events.Logger) error {
	bundler, err := bundles.NewBundler(cmd.State.SourceDir, &cmd.State.Manifest, cmd.Exclude, nil, log)
	if err != nil {
		return err
	}
	manifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	manifestPath := cmd.State.SourceDir.Join(bundles.ManifestFilename)
	log.Info("Writing manifest", "path", manifestPath)
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

type appInfo struct {
	DashboardURL string `json:"dashboard-url"`
	DirectURL    string `json:"direct-url"`
}

func logAppInfo(accountURL string, contentID apitypes.ContentID, log events.Logger) error {
	appInfo := appInfo{
		DashboardURL: fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID),
		DirectURL:    fmt.Sprintf("%s/content/%s", accountURL, contentID),
	}
	log.With(
		"dashboardURL", appInfo.DashboardURL,
		"directURL", appInfo.DirectURL,
		"serverURL", accountURL,
		"contentID", contentID,
	).Info("Deployment successful")
	jsonInfo, err := json.Marshal(appInfo)
	if err != nil {
		return err
	}
	_, err = fmt.Printf("%s\n", jsonInfo)
	return err
}

func PublishManifestFiles(cmd *cli_types.PublishArgs, lister accounts.AccountList, log events.Logger) error {
	bundler, err := bundles.NewBundlerForManifest(cmd.State.SourceDir, &cmd.State.Manifest, log)
	if err != nil {
		return err
	}
	return publish(cmd, bundler, lister, log)
}

func PublishDirectory(cmd *cli_types.PublishArgs, lister accounts.AccountList, log events.Logger) error {
	log.Info("Publishing from directory", "path", cmd.State.SourceDir)
	bundler, err := bundles.NewBundler(cmd.State.SourceDir, &cmd.State.Manifest, cmd.Exclude, nil, log)
	if err != nil {
		return err
	}
	return publish(cmd, bundler, lister, log)
}

func publish(cmd *cli_types.PublishArgs, bundler bundles.Bundler, lister accounts.AccountList, log events.Logger) error {
	account, err := lister.GetAccountByName(cmd.State.Target.AccountName)
	if err != nil {
		return err
	}
	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := clients.NewConnectClient(account, 2*time.Minute, log)
	if err != nil {
		return err
	}
	return publishWithClient(cmd, bundler, account, client, log)
}

func publishWithClient(cmd *cli_types.PublishArgs, bundler bundles.Bundler, account *accounts.Account, client clients.APIClient, log events.Logger) error {
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return events.ErrToAgentError(events.OpPublishCreateBundle, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()

	_, err = bundler.CreateBundle(bundleFile)
	if err != nil {
		return events.ErrToAgentError(events.OpPublishCreateBundle, err)
	}
	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return events.ErrToAgentError(events.OpPublishCreateBundle, err)
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
			return events.ErrToAgentError(events.OpPublishCreateDeployment, err)
		}
	}
	bundleID, err := client.UploadBundle(contentID, bundleFile)
	if err != nil {
		return events.ErrToAgentError(events.OpPublishUploadBundle, err)
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
		return events.ErrToAgentError(events.OpPublishDeployBundle, err)
	}
	taskLogger := log.With(
		"source", "server deployment log",
		"server", account.URL,
		"content_id", contentID,
		"bundle_id", bundleID,
		"task_id", taskID,
	)
	err = client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}
	return logAppInfo(account.URL, contentID, log)
}
