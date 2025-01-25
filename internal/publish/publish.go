package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"maps"
	"os"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/project"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type Publisher interface {
	PublishDirectory() error
}

type defaultPublisher struct {
	*state.State
	log            logging.Logger
	emitter        events.Emitter
	rPackageMapper renv.PackageMapper
	r              util.Path
	python         util.Path
}

type baseEventData struct {
	LocalID state.LocalDeploymentID `mapstructure:"localId"`
}

type publishStartData struct {
	Server string `mapstructure:"server"`
	Title  string `mapstructure:"title"`
}

type publishSuccessData struct {
	ContentID    types.ContentID `mapstructure:"contentId"`
	DashboardURL string          `mapstructure:"dashboardUrl"`
	LogsURL      string          `mapstructure:"logsUrl"`
	DirectURL    string          `mapstructure:"directUrl"`
	ServerURL    string          `mapstructure:"serverUrl"`
}

type publishFailureData struct {
	Message string `mapstructure:"message"`
}

type publishDeployedFailureData struct {
	DashboardURL string `mapstructure:"dashboardUrl"`
	LogsURL      string `mapstructure:"logsUrl"`
	DirectURL    string `mapstructure:"url"`
}

func NewFromState(s *state.State, rExecutable util.Path, pythonExecutable util.Path, emitter events.Emitter, log logging.Logger) (Publisher, error) {
	if s.LocalID != "" {
		data := baseEventData{
			LocalID: s.LocalID,
		}
		var dataMap events.EventData
		err := mapstructure.Decode(data, &dataMap)
		if err != nil {
			return nil, err
		}
		emitter = events.NewDataEmitter(dataMap, emitter)
	}

	packageManager, err := renv.NewPackageMapper(s.Dir, rExecutable, log)

	return &defaultPublisher{
		State:          s,
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageManager,
		r:              rExecutable,
		python:         pythonExecutable,
	}, err
}

func logAppInfo(w io.Writer, accountURL string, contentID types.ContentID, log logging.Logger, publishingErr error) {
	dashboardURL := util.GetDashboardURL(accountURL, contentID)
	logsURL := util.GetLogsURL(accountURL, contentID)
	directURL := util.GetDirectURL(accountURL, contentID)
	if publishingErr != nil {
		if contentID == "" {
			// Publishing failed before a content ID was known
			return
		}
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Logs URL: ", logsURL)
	} else {
		log.Info("Deployment information",
			logging.LogKeyOp, events.AgentOp,
			"dashboardURL", dashboardURL,
			"directURL", directURL,
			"logsURL", logsURL,
			"serverURL", accountURL,
			"contentID", contentID,
		)
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Dashboard URL: ", dashboardURL)
		fmt.Fprintln(w, "Direct URL:    ", directURL)
	}
}

func (p *defaultPublisher) isDeployed() bool {
	return p.Target != nil && p.Target.ID != ""
}

func (p *defaultPublisher) emitErrorEvents(err error) {
	agentErr, ok := err.(*types.AgentError)
	if !ok {
		agentErr = types.NewAgentError(types.ErrorUnknown, err, nil)
	}
	dashboardURL := ""
	directURL := ""
	logsURL := ""

	var data events.EventData

	mapstructure.Decode(publishFailureData{
		Message: agentErr.Message,
	}, &data)

	// Record the error in the deployment record
	if p.Target != nil {
		p.Target.Error = agentErr
		writeErr := p.writeDeploymentRecord()
		if writeErr != nil {
			p.log.Warn("failed to write updated deployment record", "name", p.TargetName, "err", writeErr)
		}
		if p.isDeployed() {
			// Provide URL in the event, if we got far enough in the deployment.
			dashboardURL = util.GetDashboardURL(p.Account.URL, p.Target.ID)
			logsURL = util.GetLogsURL(p.Account.URL, p.Target.ID)
			directURL = util.GetDirectURL(p.Account.URL, p.Target.ID)

			mapstructure.Decode(publishDeployedFailureData{
				DashboardURL: dashboardURL,
				LogsURL:      logsURL,
				DirectURL:    directURL,
			}, &data)
		}
	}

	maps.Copy(data, agentErr.GetData())

	// Fail the phase
	p.emitter.Emit(events.New(
		agentErr.GetOperation(),
		events.FailurePhase,
		agentErr.GetCode(),
		data))

	// Then fail the publishing operation as a whole
	p.emitter.Emit(events.New(
		events.PublishOp,
		events.FailurePhase,
		agentErr.GetCode(),
		data))
}

func (p *defaultPublisher) PublishDirectory() error {
	p.log.Info("Publishing from directory", logging.LogKeyOp, events.AgentOp, "path", p.Dir)
	p.emitter.Emit(events.New(events.PublishOp, events.StartPhase, events.NoError, publishStartData{
		Server: p.Account.URL,
		Title:  p.Config.Title,
	}))
	p.log.Info("Starting deployment to server", "server", p.Account.URL)

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := connect.NewConnectClient(p.Account, 2*time.Minute, p.emitter, p.log)
	if err != nil {
		return err
	}
	err = p.publishWithClient(p.Account, client)
	if p.isDeployed() {
		logAppInfo(os.Stderr, p.Account.URL, p.Target.ID, p.log, err)
	}
	if err != nil {
		p.emitErrorEvents(err)
	} else {
		p.emitter.Emit(events.New(events.PublishOp, events.SuccessPhase, events.NoError, publishSuccessData{
			DashboardURL: util.GetDashboardURL(p.Account.URL, p.Target.ID),
			LogsURL:      util.GetLogsURL(p.Account.URL, p.Target.ID),
			DirectURL:    util.GetDirectURL(p.Account.URL, p.Target.ID),
			ServerURL:    p.Account.URL,
			ContentID:    p.Target.ID,
		}))
	}
	return err
}

func (p *defaultPublisher) writeDeploymentRecord() error {
	if p.SaveName == "" {
		// Redeployment
		p.log.Debug("No SaveName found while redeploying.", "deployment", p.TargetName)
		p.SaveName = p.TargetName
	} else {
		// Initial deployment
		p.log.Debug("SaveName found in first deployment.", "deployment", p.SaveName)
		p.TargetName = p.SaveName
	}

	now := time.Now().Format(time.RFC3339)
	p.Target.DeployedAt = now
	p.Target.ConfigName = p.ConfigName
	p.Target.Configuration = p.Config

	recordPath := deployment.GetDeploymentPath(p.Dir, p.SaveName)
	p.log.Debug("Writing deployment record", "path", recordPath)
	return p.Target.WriteFile(recordPath)
}

func (p *defaultPublisher) createDeploymentRecord(
	contentID types.ContentID,
	account *accounts.Account) error {

	// Initial deployment record doesn't know the files or
	// bundleID. These will be added after the
	// bundle upload.
	cfg := *p.Config

	created := ""
	var contentType config.ContentType

	if p.Target != nil {
		created = p.Target.CreatedAt
		contentType = p.Target.Type
		if contentType == "" || contentType == config.ContentTypeUnknown {
			contentType = cfg.Type
		}
	} else {
		created = time.Now().Format(time.RFC3339)
		contentType = cfg.Type
	}

	p.Target = &deployment.Deployment{
		Schema:        schema.DeploymentSchemaURL,
		ServerType:    account.ServerType,
		ServerURL:     account.URL,
		ClientVersion: project.Version,
		Type:          contentType,
		CreatedAt:     created,
		ID:            contentID,
		ConfigName:    p.ConfigName,
		Files:         nil,
		Requirements:  nil,
		Configuration: &cfg,
		BundleID:      "",
		DashboardURL:  util.GetDashboardURL(p.Account.URL, contentID),
		DirectURL:     util.GetDirectURL(p.Account.URL, contentID),
		LogsURL:       util.GetLogsURL(p.Account.URL, contentID),
		Error:         nil,
	}

	// Save current deployment information for this target
	return p.writeDeploymentRecord()
}

func (p *defaultPublisher) publishWithClient(
	account *accounts.Account,
	client connect.APIClient) error {

	manifest := bundles.NewManifestFromConfig(p.Config)
	p.log.Debug("Built manifest from config", "config", p.ConfigName)

	if p.Config.R != nil {
		rPackages, err := p.getRPackages()
		if err != nil {
			return err
		}
		manifest.Packages = rPackages
	}
	bundler, err := bundles.NewBundler(p.Dir, manifest, p.Config.Files, p.log)
	if err != nil {
		return err
	}

	err = p.preFlightChecks(client)
	if err != nil {
		return err
	}

	var contentID types.ContentID
	if p.isDeployed() {
		contentID = p.Target.ID
		p.log.Info("Updating deployment", "content_id", contentID)
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = p.createDeployment(client)
	}
	if err != nil {
		return err
	}

	err = p.createDeploymentRecord(contentID, account)
	if err != nil {
		return types.OperationError(events.PublishCreateNewDeploymentOp, err)
	}

	bundleID, err := p.createAndUploadBundle(client, bundler, contentID)
	if err != nil {
		return err
	}

	err = p.updateContent(client, contentID)
	if err != nil {
		return err
	}

	err = p.setEnvVars(client, contentID)
	if err != nil {
		return err
	}

	taskID, err := p.deployBundle(client, contentID, bundleID)
	if err != nil {
		return err
	}

	taskLogger := p.log.WithArgs("source", "server.log")
	err = client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}

	if p.Config.Validate {
		err = p.validateContent(client, contentID)
		if err != nil {
			return err
		}
	}
	return nil
}
