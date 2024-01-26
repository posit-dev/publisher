package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/clients/http_client"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/project"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type Publisher interface {
	PublishDirectory(logging.Logger) error
}

type defaultPublisher struct {
	*state.State
}

func New(path util.Path, accountName, configName, targetName string, saveName string, accountList accounts.AccountList) (Publisher, error) {
	s, err := state.New(path, accountName, configName, targetName, saveName, accountList)
	if err != nil {
		return nil, err
	}
	return &defaultPublisher{s}, nil
}

func NewFromState(s *state.State) Publisher {
	return &defaultPublisher{s}
}

func getDashboardURL(accountURL string, contentID types.ContentID) string {
	return fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID)
}

func getDirectURL(accountURL string, contentID types.ContentID) string {
	return fmt.Sprintf("%s/content/%s", accountURL, contentID)
}

func getBundleURL(accountURL string, contentID types.ContentID, bundleID types.BundleID) string {
	return fmt.Sprintf("%s/__api__/v1/content/%s/bundles/%s/download", accountURL, contentID, bundleID)
}

func logAppInfo(w io.Writer, accountURL string, contentID types.ContentID, log logging.Logger, publishingErr error) {
	dashboardURL := getDashboardURL(accountURL, contentID)
	directURL := getDirectURL(accountURL, contentID)
	if publishingErr != nil {
		if contentID == "" {
			// Publishing failed before a content ID was known
			return
		}
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Dashboard URL: ", dashboardURL)
	} else {
		log.Success("Deployment successful",
			logging.LogKeyOp, events.PublishOp,
			"dashboardURL", dashboardURL,
			"directURL", directURL,
			"serverURL", accountURL,
			"contentID", contentID,
		)
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Dashboard URL: ", dashboardURL)
		fmt.Fprintln(w, "Direct URL:    ", directURL)
	}
}

func (p *defaultPublisher) PublishDirectory(log logging.Logger) error {
	log.Info("Publishing from directory", "path", p.Dir)
	manifest := bundles.NewManifestFromConfig(p.Config)
	bundler, err := bundles.NewBundler(p.Dir, manifest, nil, log)
	if err != nil {
		return err
	}
	return p.publish(bundler, log)
}

func (p *defaultPublisher) isDeployed() bool {
	return p.Target != nil && p.Target.ID != ""
}

func (p *defaultPublisher) publish(
	bundler bundles.Bundler,
	log logging.Logger) error {

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := connect.NewConnectClient(p.Account, 2*time.Minute, log)
	if err != nil {
		return err
	}
	err = p.publishWithClient(bundler, p.Account, client, log)
	if err != nil {
		log.Failure(err)

		// Also fail the overall operation
		agentErr, ok := err.(*types.AgentError)
		if ok {
			if p.Target != nil {
				p.Target.Error = agentErr
				writeErr := p.writeDeploymentRecord(log)
				if writeErr != nil {
					log.Warn("failed to write updated deployment record", "name", p.TargetName, "err", err)
				}
				if p.isDeployed() {
					agentErr.Data["dashboard_url"] = getDashboardURL(p.Account.URL, p.Target.ID)
				}
			}
			agentErr.SetOperation(events.PublishOp)
			log.Failure(agentErr)
		}
	}
	if p.isDeployed() {
		logAppInfo(os.Stderr, p.Account.URL, p.Target.ID, log, err)
	}
	return err
}

type DeploymentNotFoundDetails struct {
	ContentID types.ContentID
}

func (p *defaultPublisher) checkConfiguration(client connect.APIClient, log logging.Logger) error {
	op := events.PublishCheckCapabilitiesOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Checking configuration against server capabilities")

	user, err := client.TestAuthentication(log)
	if err != nil {
		return types.OperationError(op, err)
	}
	log.Info("Publishing with credentials", "username", user.Username, "email", user.Email)

	err = client.CheckCapabilities(p.Config, log)
	if err != nil {
		return types.OperationError(op, err)
	}
	log.Success("Configuration OK")
	return nil
}

func (p *defaultPublisher) createDeployment(client connect.APIClient, log logging.Logger) (types.ContentID, error) {
	op := events.PublishCreateNewDeploymentOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Creating new deployment")

	contentID, err := client.CreateDeployment(&connect.ConnectContent{}, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}
	log.Success("Created deployment", "content_id", contentID, "save_name", p.SaveName)
	return contentID, nil
}

func (p *defaultPublisher) writeDeploymentRecord(log logging.Logger) error {
	recordPath := deployment.GetDeploymentPath(p.Dir, p.TargetName)
	return p.Target.WriteFile(recordPath)
}

func (p *defaultPublisher) createDeploymentRecord(
	bundler bundles.Bundler,
	contentID types.ContentID,
	account *accounts.Account,
	log logging.Logger) error {

	// Initial deployment record doesn't know the files or
	// bundleID. These will be added after the
	// bundle upload.
	cfg := *p.Config

	now := time.Now().Format(time.RFC3339)
	created := now
	if p.Target != nil {
		created = p.Target.CreatedAt
	}

	p.Target = &deployment.Deployment{
		Schema:        schema.DeploymentSchemaURL,
		ServerType:    account.ServerType,
		ServerURL:     account.URL,
		ClientVersion: project.Version,
		CreatedAt:     created,
		ID:            contentID,
		ConfigName:    p.ConfigName,
		Files:         nil,
		Configuration: &cfg,
		DeployedAt:    now,
		BundleID:      "",
		DashboardURL:  getDashboardURL(p.Account.URL, contentID),
		DirectURL:     getDirectURL(p.Account.URL, contentID),
		Error:         nil,
	}

	// Save current deployment information for this target
	if p.SaveName != "" {
		if p.TargetName != "" {
			err := deployment.RenameDeployment(p.Dir, p.TargetName, p.SaveName)
			if err != nil {
				return err
			}
		}
		p.TargetName = p.SaveName
	} else if p.TargetName == "" {
		p.TargetName = string(contentID)
	}
	return p.writeDeploymentRecord(log)
}

func (p *defaultPublisher) createAndUploadBundle(
	client connect.APIClient,
	bundler bundles.Bundler,
	contentID types.ContentID,
	log logging.Logger) (types.BundleID, error) {

	// Create Bundle step
	op := events.PublishCreateBundleOp
	prepareLog := log.WithArgs(logging.LogKeyOp, op)
	prepareLog.Start("Preparing files")
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return "", types.OperationError(op, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()
	manifest, err := bundler.CreateBundle(bundleFile)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return "", types.OperationError(op, err)
	}
	prepareLog.Success("Done preparing files", "filename", bundleFile.Name())

	// Upload Bundle step
	op = events.PublishUploadBundleOp
	uploadLog := log.WithArgs(logging.LogKeyOp, op)
	uploadLog.Start("Uploading files")

	bundleID, err := client.UploadBundle(contentID, bundleFile, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	// Update deployment record with new information
	p.Target.Files = manifest.GetFilenames()
	p.Target.BundleID = bundleID
	p.Target.BundleURL = getBundleURL(p.Account.URL, contentID, bundleID)

	err = p.writeDeploymentRecord(log)
	if err != nil {
		return "", err
	}
	uploadLog.Success("Done uploading files", "bundle_id", bundleID)
	return bundleID, nil
}

func (p *defaultPublisher) updateContent(
	client connect.APIClient,
	contentID types.ContentID,
	log logging.Logger) error {

	op := events.PublishUpdateDeploymentOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Updating deployment settings", "content_id", contentID, "save_name", p.SaveName)

	connectContent := connect.ConnectContentFromConfig(p.Config)
	err := client.UpdateDeployment(contentID, connectContent, log)
	if err != nil {
		return types.OperationError(op, err)
	}
	if err != nil {
		httpErr, ok := err.(*http_client.HTTPError)
		if ok && httpErr.Status == http.StatusNotFound {
			details := DeploymentNotFoundDetails{
				ContentID: contentID,
			}
			return types.NewAgentError(events.DeploymentNotFoundCode, err, details)
		}
		return err
	}
	log.Success("Done updating settings")
	return nil
}

func (p *defaultPublisher) setEnvVars(
	client connect.APIClient,
	contentID types.ContentID,
	log logging.Logger) error {

	env := p.Config.Environment
	if len(env) == 0 {
		return nil
	}

	op := events.PublishSetEnvVarsOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Setting environment variables")

	for name, value := range env {
		log.Info("Setting environment variable", "name", name, "value", value)
	}
	err := client.SetEnvVars(contentID, env, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Success("Done setting environment variables")
	return nil
}

func (p *defaultPublisher) deployBundle(
	client connect.APIClient,
	contentID types.ContentID,
	bundleID types.BundleID,
	log logging.Logger) (types.TaskID, error) {

	op := events.PublishDeployBundleOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Activating Deployment")

	taskID, err := client.DeployBundle(contentID, bundleID, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}
	log.Success("Activation requested")
	return taskID, nil
}

func (p *defaultPublisher) validateContent(
	client connect.APIClient,
	contentID types.ContentID,
	log logging.Logger) error {

	op := events.PublishValidateDeploymentOp
	log = log.WithArgs(logging.LogKeyOp, op)
	log.Start("Validating Deployment")

	err := client.ValidateDeployment(contentID, log)
	if err != nil {
		return types.OperationError(op, err)
	}
	log.Success("Done validating deployment")
	return nil
}

func (p *defaultPublisher) publishWithClient(
	bundler bundles.Bundler,
	account *accounts.Account,
	client connect.APIClient,
	log logging.Logger) error {

	log.Start("Starting deployment to server",
		logging.LogKeyOp, events.PublishOp,
		"server", account.URL,
	)

	err := p.checkConfiguration(client, log)
	if err != nil {
		return err
	}

	var contentID types.ContentID
	if p.isDeployed() {
		contentID = p.Target.ID
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = p.createDeployment(client, log)
		if err != nil {
			return err
		}
	}
	err = p.createDeploymentRecord(bundler, contentID, account, log)
	if err != nil {
		return types.OperationError(events.PublishCreateNewDeploymentOp, err)
	}

	bundleID, err := p.createAndUploadBundle(client, bundler, contentID, log)
	if err != nil {
		return err
	}

	err = p.updateContent(client, contentID, log)
	if err != nil {
		return err
	}

	err = p.setEnvVars(client, contentID, log)
	if err != nil {
		return err
	}

	taskID, err := p.deployBundle(client, contentID, bundleID, log)
	if err != nil {
		return err
	}

	taskLogger := log.WithArgs("source", "server.log")
	err = client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}

	if p.Config.Validate {
		err = p.validateContent(client, contentID, log)
		if err != nil {
			return err
		}
	}
	return nil
}
