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
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type Publisher struct {
	args *cli_types.PublishArgs
}

func New(args *cli_types.PublishArgs) *Publisher {
	return &Publisher{
		args: args,
	}
}

func (p *Publisher) CreateBundleFromDirectory(dest util.Path, log logging.Logger) error {
	bundleFile, err := dest.Create()
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	bundler, err := bundles.NewBundler(p.args.State.SourceDir, &p.args.State.Manifest, p.args.Exclude, nil, log)
	if err != nil {
		return err
	}
	_, err = bundler.CreateBundle(bundleFile)
	return err
}

func (p *Publisher) WriteManifestFromDirectory(log logging.Logger) error {
	bundler, err := bundles.NewBundler(p.args.State.SourceDir, &p.args.State.Manifest, p.args.Exclude, nil, log)
	if err != nil {
		return err
	}
	manifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	manifestPath := p.args.State.SourceDir.Join(bundles.ManifestFilename)
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

func (p *Publisher) logAppInfo(accountURL string, contentID types.ContentID, log logging.Logger) error {
	appInfo := appInfo{
		DashboardURL: fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID),
		DirectURL:    fmt.Sprintf("%s/content/%s", accountURL, contentID),
	}
	log.Success("Deployment successful",
		logging.LogKeyOp, events.PublishOp,
		"dashboardURL", appInfo.DashboardURL,
		"directURL", appInfo.DirectURL,
		"serverURL", accountURL,
		"contentID", contentID,
	)
	jsonInfo, err := json.Marshal(appInfo)
	if err != nil {
		return err
	}
	_, err = fmt.Printf("%s\n", jsonInfo)
	return err
}

func (p *Publisher) PublishManifestFiles(lister accounts.AccountList, log logging.Logger) error {
	bundler, err := bundles.NewBundlerForManifest(p.args.State.SourceDir, &p.args.State.Manifest, log)
	if err != nil {
		return err
	}
	return p.publish(bundler, lister, log)
}

func (p *Publisher) PublishDirectory(lister accounts.AccountList, log logging.Logger) error {
	log.Info("Publishing from directory", "path", p.args.State.SourceDir)
	bundler, err := bundles.NewBundler(p.args.State.SourceDir, &p.args.State.Manifest, p.args.Exclude, nil, log)
	if err != nil {
		return err
	}
	return p.publish(bundler, lister, log)
}

func (p *Publisher) publish(
	bundler bundles.Bundler,
	lister accounts.AccountList,
	log logging.Logger) error {

	account, err := lister.GetAccountByName(p.args.State.Target.AccountName)
	if err != nil {
		return err
	}
	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := clients.NewConnectClient(account, 2*time.Minute, log)
	if err != nil {
		return err
	}
	err = p.publishWithClient(bundler, account, client, log)
	if err != nil {
		log.Failure(err)
	}
	return nil
}

type DeploymentNotFoundDetails struct {
	ContentID types.ContentID
}

func withLog[T any](
	op events.Operation,
	msg string,
	label string,
	log logging.Logger,
	fn func() (T, error)) (value T, err error) {

	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start(msg)
	value, err = fn()
	if err != nil {
		// Using implicit return values here since we
		// can't construct an empty T{}
		err = types.ErrToAgentError(op, err)
		return
	}
	log.Success("Done", label, value)
	return value, nil
}

func (p *Publisher) publishWithClient(
	bundler bundles.Bundler,
	account *accounts.Account,
	client clients.APIClient,
	log logging.Logger) error {

	log.Start("Starting deployment to server",
		logging.LogKeyOp, events.PublishOp,
		"server", account.URL,
	)
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()

	_, err = withLog(events.PublishCreateBundleOp, "Creating bundle", "filename", log, func() (any, error) {
		_, err := bundler.CreateBundle(bundleFile)
		return bundleFile.Name(), err
	})
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}
	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}

	var contentID types.ContentID
	if p.args.State.Target.ContentId != "" && !p.args.New {
		contentID = p.args.State.Target.ContentId
		_, err := withLog(events.PublishCreateDeploymentOp, "Updating deployment", "content_id", log, func() (any, error) {
			return contentID, client.UpdateDeployment(contentID, p.args.State.Connect.Content)
		})
		if err != nil {
			httpErr, ok := err.(*clients.HTTPError)
			if ok && httpErr.Status == http.StatusNotFound {
				details := DeploymentNotFoundDetails{
					ContentID: contentID,
				}
				return types.NewAgentError(events.DeploymentNotFoundCode, err, details)
			}
			return err
		}
	} else {
		contentID, err = withLog(events.PublishCreateDeploymentOp, "Creating deployment", "content_id", log, func() (types.ContentID, error) {
			return client.CreateDeployment(p.args.State.Connect.Content)
		})
		if err != nil {
			return err
		}
		log.Info("content_id", contentID)
	}

	bundleID, err := withLog(events.PublishUploadBundleOp, "Uploading deployment bundle", "bundle_id", log, func() (types.BundleID, error) {
		return client.UploadBundle(contentID, bundleFile)
	})
	if err != nil {
		return err
	}

	p.args.State.Target = state.TargetID{
		ServerType:  account.ServerType,
		AccountName: account.Name,
		ServerURL:   account.URL,
		ContentId:   contentID,
		ContentName: "",
		Username:    account.AccountName,
		BundleId:    types.NewOptional(bundleID),
		DeployedAt:  types.NewOptional(time.Now()),
	}

	taskID, err := withLog(events.PublishDeployBundleOp, "Initiating bundle deployment", "task_id", log, func() (types.TaskID, error) {
		return client.DeployBundle(contentID, bundleID)
	})
	if err != nil {
		return err
	}

	taskLogger := log.WithArgs("source", "serverp.log")
	err = client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}
	log = log.WithArgs(logging.LogKeyOp, events.AgentOp)
	return p.logAppInfo(account.URL, contentID, log)
}
