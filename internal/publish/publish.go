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
	PublishDirectory(logging.Logger) error
}

type defaultPublisher struct {
	*state.State
	emitter        events.Emitter
	rPackageMapper renv.PackageMapper
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
	DirectURL    string          `mapstructure:"directUrl"`
	ServerURL    string          `mapstructure:"serverUrl"`
}

type publishFailureData struct {
	Message string `mapstructure:"message"`
}

type publishDeployedFailureData struct {
	DashboardURL string `mapstructure:"dashboardUrl"`
	DirectURL    string `mapstructure:"url"`
}

func NewFromState(s *state.State, emitter events.Emitter, log logging.Logger) (Publisher, error) {
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
	return &defaultPublisher{
		State:          s,
		emitter:        emitter,
		rPackageMapper: renv.NewPackageMapper(s.Dir, util.Path{}),
	}, nil
}

func getDashboardURL(accountURL string, contentID types.ContentID, failed bool) string {
	url := fmt.Sprintf("%s/connect/#/apps/%s", accountURL, contentID)
	if failed {
		url += "/logs"
	}
	return url
}

func getDirectURL(accountURL string, contentID types.ContentID) string {
	return fmt.Sprintf("%s/content/%s", accountURL, contentID)
}

func getBundleURL(accountURL string, contentID types.ContentID, bundleID types.BundleID) string {
	return fmt.Sprintf("%s/__api__/v1/content/%s/bundles/%s/download", accountURL, contentID, bundleID)
}

func logAppInfo(w io.Writer, accountURL string, contentID types.ContentID, log logging.Logger, publishingErr error) {
	dashboardURL := getDashboardURL(accountURL, contentID, publishingErr != nil)
	directURL := getDirectURL(accountURL, contentID)
	if publishingErr != nil {
		if contentID == "" {
			// Publishing failed before a content ID was known
			return
		}
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Dashboard URL: ", dashboardURL)
	} else {
		log.Info("Deployment information",
			logging.LogKeyOp, events.AgentOp,
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

func (p *defaultPublisher) isDeployed() bool {
	return p.Target != nil && p.Target.ID != ""
}

func (p *defaultPublisher) emitErrorEvents(err error, log logging.Logger) {
	agentErr, ok := err.(*types.AgentError)
	if !ok {
		agentErr = types.NewAgentError(types.UnknownErrorCode, err, nil)
	}
	dashboardURL := ""
	directURL := ""

	var data events.EventData

	mapstructure.Decode(publishFailureData{
		Message: agentErr.Error(),
	}, &data)

	// Record the error in the deployment record
	if p.Target != nil {
		p.Target.Error = agentErr
		writeErr := p.writeDeploymentRecord()
		if writeErr != nil {
			log.Warn("failed to write updated deployment record", "name", p.TargetName, "err", writeErr)
		}
		if p.isDeployed() {
			// Provide URL in the event, if we got far enough in the deployment.
			dashboardURL = getDashboardURL(p.Account.URL, p.Target.ID, err != nil)
			directURL = getDirectURL(p.Account.URL, p.Target.ID)

			mapstructure.Decode(publishDeployedFailureData{
				DashboardURL: dashboardURL,
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

func (p *defaultPublisher) PublishDirectory(log logging.Logger) error {
	log.Info("Publishing from directory", logging.LogKeyOp, events.AgentOp, "path", p.Dir)
	p.emitter.Emit(events.New(events.PublishOp, events.StartPhase, events.NoError, publishStartData{
		Server: p.Account.URL,
		Title:  p.Config.Title,
	}))
	log.Info("Starting deployment to server", "server", p.Account.URL)

	// TODO: factory method to create client based on server type
	// TODO: timeout option
	client, err := connect.NewConnectClient(p.Account, 2*time.Minute, p.emitter, log)
	if err != nil {
		return err
	}
	err = p.publishWithClient(p.Account, client, log)
	if p.isDeployed() {
		logAppInfo(os.Stderr, p.Account.URL, p.Target.ID, log, err)
	}
	if err != nil {
		p.emitErrorEvents(err, log)
	} else {
		p.emitter.Emit(events.New(events.PublishOp, events.SuccessPhase, events.NoError, publishSuccessData{
			DashboardURL: getDashboardURL(p.Account.URL, p.Target.ID, false),
			DirectURL:    getDirectURL(p.Account.URL, p.Target.ID),
			ServerURL:    p.Account.URL,
			ContentID:    p.Target.ID,
		}))
	}
	return err
}

func (p *defaultPublisher) writeDeploymentRecord() error {
	if p.SaveName == "" {
		// Redeployment
		p.SaveName = p.TargetName
	} else {
		// Initial deployment
		p.TargetName = p.SaveName
	}

	now := time.Now().Format(time.RFC3339)
	p.Target.DeployedAt = now
	p.Target.ConfigName = p.ConfigName
	p.Target.Configuration = p.Config

	recordPath := deployment.GetDeploymentPath(p.Dir, p.SaveName)
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
		DashboardURL:  getDashboardURL(p.Account.URL, contentID, false),
		DirectURL:     getDirectURL(p.Account.URL, contentID),
		Error:         nil,
	}

	// Save current deployment information for this target
	return p.writeDeploymentRecord()
}

func (p *defaultPublisher) publishWithClient(
	account *accounts.Account,
	client connect.APIClient,
	log logging.Logger) error {

	manifest := bundles.NewManifestFromConfig(p.Config)
	filePatterns := p.Config.Files
	if len(filePatterns) == 0 {
		log.Info("No file patterns specified; using default pattern '*'")
		filePatterns = []string{"*"}
	}
	if p.Config.R != nil {
		rPackages, err := p.getRPackages(log)
		if err != nil {
			return err
		}
		manifest.Packages = rPackages
	}
	bundler, err := bundles.NewBundler(p.Dir, manifest, filePatterns, log)
	if err != nil {
		return err
	}

	err = p.checkConfiguration(client, log)
	if err != nil {
		return err
	}

	var contentID types.ContentID
	if p.isDeployed() {
		contentID = p.Target.ID
		log.Info("Updating deployment", "content_id", contentID)
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = p.createDeployment(client, log)
		if err != nil {
			return err
		}
	}
	err = p.createDeploymentRecord(contentID, account)
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
