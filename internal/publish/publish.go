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
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/clients/http_client"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
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

func New(path util.Path, accountName, configName, targetID string, accountList accounts.AccountList) (Publisher, error) {
	s, err := state.New(path, accountName, configName, targetID, accountList)
	if err != nil {
		return nil, err
	}
	return &defaultPublisher{s}, nil
}

func NewFromState(s *state.State) Publisher {
	return &defaultPublisher{s}
}

type appInfo struct {
	DashboardURL string `json:"dashboard-url"`
	DirectURL    string `json:"direct-url"`
}

func (p *defaultPublisher) logAppInfo(accountURL string, contentID types.ContentID, log logging.Logger) error {
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
			log.Failure(agentErr)
		}
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
		Id:            contentID,
		ConfigName:    p.ConfigName,
		Files:         createdManifest.GetFilenames(),
		Configuration: *p.Config,
		DeployedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	// Save current deployment information for this target
	recordPath := deployment.GetLatestDeploymentPath(p.Dir, string(contentID))
	log.Info("Writing deployment record", "path", recordPath)
	err = p.Target.WriteFile(recordPath)
	if err != nil {
		return err
	}
	// and create a new history entry
	historyPath, err := deployment.GetDeploymentHistoryPath(p.Dir, string(contentID))
	if err != nil {
		return err
	}
	log.Info("Writing history record", "path", historyPath)
	err = p.Target.WriteFile(historyPath)
	if err != nil {
		return err
	}
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

	var contentID types.ContentID
	var err error

	if p.Target != nil {
		contentID = p.Target.Id
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = withLog(events.PublishCreateDeploymentOp, "Creating deployment", "content_id", log, func() (types.ContentID, error) {
			return client.CreateDeployment(&connect.ConnectContent{})
		})
		if err != nil {
			return err
		}
	}
	err = p.createDeploymentRecord(bundler, contentID, account, log)
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateDeploymentOp, err)
	}

	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()
	_, err = withLog(events.PublishCreateBundleOp, "Creating bundle", "filename", log, func() (any, error) {
		_, err = bundler.CreateBundle(bundleFile)
		return bundleFile.Name(), err
	})
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}
	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return types.ErrToAgentError(events.PublishCreateBundleOp, err)
	}

	bundleID, err := withLog(events.PublishUploadBundleOp, "Uploading deployment bundle", "count", log, func() (types.BundleID, error) {
		return client.UploadBundle(contentID, bundleFile)
	})
	if err != nil {
		return err
	}

	// Update app settings
	connectContent := connect.ConnectContentFromConfig(p.Config)
	_, err = withLog(events.PublishCreateDeploymentOp, "Updating deployment settings", "content_id", log, func() (any, error) {
		return contentID, client.UpdateDeployment(contentID, connectContent)
	})
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

	env := p.Config.Environment
	if len(env) != 0 {
		_, err = withLog(events.PublishSetEnvVarsOp, "Setting environment variables", "count", log, func() (int, error) {
			for name, value := range env {
				log.Info("Setting environment variable", "name", name, "value", value)
			}
			return len(env), client.SetEnvVars(contentID, env)
		})
		if err != nil {
			return err
		}
	}

	taskID, err := withLog(events.PublishDeployBundleOp, "Initiating bundle deployment", "task_id", log, func() (types.TaskID, error) {
		return client.DeployBundle(contentID, bundleID)
	})
	if err != nil {
		return err
	}

	taskLogger := log.WithArgs("source", "server.log")
	err = client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}

	if p.Config.Validate {
		_, err := withLog(events.PublishValidateDeploymentOp, "Validating deployment", "ok", log, func() (bool, error) {
			return true, client.ValidateDeployment(contentID)
		})
		if err != nil {
			return err
		}
	}

	log = log.WithArgs(logging.LogKeyOp, events.AgentOp)
	return p.logAppInfo(account.URL, contentID, log)
}
