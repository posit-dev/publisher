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
	"github.com/posit-dev/publisher/internal/interpreters"
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

func NewFromState(s *state.State, rInterpreter interpreters.RInterpreter, pythonInterpreter interpreters.PythonInterpreter, emitter events.Emitter, log logging.Logger) (Publisher, error) {
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

	// It is ok if the system does not have R or Python interpreters.
	rexec, _ := rInterpreter.GetRExecutable()
	pyexec, _ := pythonInterpreter.GetPythonExecutable()

	packageManager, err := renv.NewPackageMapper(s.Dir, rexec.Path, log)

	// Handle difference where we have no SaveName when redeploying, since it is
	// only sent in the first deployment. In the end, both should equate to same
	// value, it is important to handle assignment in a specific priority
	if s.SaveName == "" {
		// Redeployment
		s.SaveName = s.TargetName
	} else {
		// Initial deployment
		s.TargetName = s.SaveName
	}

	return &defaultPublisher{
		State:          s,
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageManager,
		r:              rexec.Path,
		python:         pyexec.Path,
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
		_, writeErr := p.writeDeploymentRecord()
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

var clientFactory = connect.NewConnectClient

func (p *defaultPublisher) PublishDirectory() error {
	p.log.Info("Publishing from directory", logging.LogKeyOp, events.AgentOp, "path", p.Dir, "localID", p.State.LocalID)
	p.emitter.Emit(events.New(events.PublishOp, events.StartPhase, events.NoError, publishStartData{
		Server: p.Account.URL,
		Title:  p.Config.Title,
	}))
	p.log.Info("Starting deployment to server", "server", p.Account.URL)

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := clientFactory(p.Account, 2*time.Minute, p.emitter, p.log)
	if err != nil {
		p.emitErrorEvents(err)
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

func (p *defaultPublisher) writeDeploymentRecord() (*deployment.Deployment, error) {
	now := time.Now().Format(time.RFC3339)
	p.Target.DeployedAt = now
	p.Target.ConfigName = p.ConfigName
	p.Target.Configuration = p.Config

	recordPath := deployment.GetDeploymentPath(p.Dir, p.SaveName)
	localID := string(p.State.LocalID)
	return p.Target.WriteFile(recordPath, localID, p.log)
}

func CancelDeployment(
	deploymentPath util.AbsolutePath,
	localID string,
	log logging.Logger,
) (*deployment.Deployment, error) {
	// This function only marks the deployment record as being canceled.
	// It does not cancel the anonymous function which is publishing to the server
	// This is because the server API does not support cancellation at this time.

	target, err := deployment.FromFile(deploymentPath)
	if err != nil {
		return nil, err
	}

	// mark the deployment as dismissed
	target.DismissedAt = time.Now().Format(time.RFC3339)
	// clear the error as well
	target.Error = nil

	// take over ownership of deployment file
	newLocalID := "CANCELLED"
	deployment.ActiveDeploymentRegistry.Set(deploymentPath.String(), newLocalID)

	// Update the deployment file (should be guaranteed now that we just set ownership
	// with a fake local ID that only we know).
	d, err := target.WriteFile(deploymentPath, newLocalID, log)
	return d, err
}

func (p *defaultPublisher) createDeploymentRecord(
	contentID types.ContentID,
	account *accounts.Account) {

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
		DismissedAt:   "",
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

}

func (p *defaultPublisher) publishWithClient(
	account *accounts.Account,
	client connect.APIClient) error {

	var err error
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

	p.createDeploymentRecord(contentID, account)

	manifest := bundles.NewManifestFromConfig(p.Config)
	p.log.Debug("Built manifest from config", "config", p.ConfigName)

	if p.Config.R != nil {
		rPackages, err := p.getRPackages()
		if err != nil {
			return err
		}
		manifest.Packages = rPackages
	}
	p.log.Debug("Generated manifest:", manifest)

	bundler, err := bundles.NewBundler(p.Dir, manifest, p.Config.Files, p.log)
	if err != nil {
		return err
	}

	err = p.preFlightChecks(client)
	if err != nil {
		return err
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
