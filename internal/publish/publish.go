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
			agentErr.SetOperation(events.PublishOp)
			if p.Target != nil {
				agentErr.Data["dashboard_url"] = getDashboardURL(p.Account.URL, p.Target.Id)
			}
			log.Failure(agentErr)
		}
	}
	if p.Target != nil {
		logAppInfo(os.Stderr, p.Account.URL, p.Target.Id, log, err)
	}
	return nil
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
		return types.ErrToAgentError(op, err)
	}
	log.Info("Publishing with credentials", "username", user.Username, "email", user.Email)

	err = client.CheckCapabilities(p.Config, log)
	if err != nil {
		return types.ErrToAgentError(op, err)
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
		return "", types.ErrToAgentError(op, err)
	}
	log.Success("Created deployment", "content_id", contentID, "save_name", p.SaveName)
	return contentID, nil
}

func (p *defaultPublisher) createDeploymentRecord(
	bundler bundles.Bundler,
	contentID types.ContentID,
	account *accounts.Account,
	log logging.Logger) error {

	// Scan the directory to get the file list for the deployment record
	createdManifest, err := bundler.CreateManifest()
	if err != nil {
		return err
	}
	p.Target = &deployment.Deployment{
		Schema:        schema.DeploymentSchemaURL,
		ServerType:    account.ServerType,
		ServerURL:     account.URL,
		ClientVersion: project.Version,
		Id:            contentID,
		ConfigName:    p.ConfigName,
		Files:         createdManifest.GetFilenames(),
		Configuration: *p.Config,
		DeployedAt:    time.Now().UTC().Format(time.RFC3339),
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
	recordPath := deployment.GetDeploymentPath(p.Dir, p.TargetName)
	log.Info("Writing deployment record", "path", recordPath)
	return p.Target.WriteFile(recordPath)
}

func (p *defaultPublisher) createAndUploadBundle(
	client connect.APIClient,
	bundler bundles.Bundler,
	contentID types.ContentID,
	log logging.Logger) (types.BundleID, error) {

	op := events.PublishCreateBundleOp
	prepareLog := log.WithArgs(logging.LogKeyOp, op)
	prepareLog.Start("Preparing files")
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return "", types.ErrToAgentError(op, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()
	_, err = bundler.CreateBundle(bundleFile)
	if err != nil {
		return "", types.ErrToAgentError(op, err)
	}
	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return "", types.ErrToAgentError(op, err)
	}
	prepareLog.Success("Done preparing files", "filename", bundleFile.Name())

	op = events.PublishUploadBundleOp
	uploadLog := log.WithArgs(logging.LogKeyOp, op)
	uploadLog.Start("Uploading files")

	bundleID, err := client.UploadBundle(contentID, bundleFile, log)
	if err != nil {
		return "", types.ErrToAgentError(op, err)
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
		return types.ErrToAgentError(op, err)
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
		return types.ErrToAgentError(op, err)
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
		return "", types.ErrToAgentError(op, err)
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
		return types.ErrToAgentError(op, err)
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
	if p.Target != nil {
		contentID = p.Target.Id
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = p.createDeployment(client, log)
		if err != nil {
			return err
		}
	}
	err = p.createDeploymentRecord(bundler, contentID, account, log)
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateNewDeploymentOp, err)
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
