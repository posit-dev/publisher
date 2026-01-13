package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"maps"
	"os"
	"time"

	"github.com/mitchellh/mapstructure"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/project"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type Publisher interface {
	PublishDirectory() error
}

type defaultPublisher struct {
	log            logging.Logger
	emitter        events.Emitter
	rPackageMapper renv.PackageMapper
	r              util.Path
	python         util.Path
	*publishhelper.PublishHelper
	serverPublisher ServerPublisher
	// true when using legacy library-based manifest package generation
	rPackagesFromLibrary bool
}

type createBundleStartData struct{}
type createBundleSuccessData struct {
	Filename string `mapstructure:"filename"`
}

type baseEventData struct {
	LocalID state.LocalDeploymentID `mapstructure:"localId"`
}

type publishStartData struct {
	Server      string             `mapstructure:"server"`
	Title       string             `mapstructure:"title"`
	ProductType config.ProductType `mapstructure:"productType"`
}

type publishSuccessData struct {
	ContentID    types.ContentID    `mapstructure:"contentId"`
	DashboardURL string             `mapstructure:"dashboardUrl"`
	LogsURL      string             `mapstructure:"logsUrl"`
	DirectURL    string             `mapstructure:"directUrl"`
	ServerURL    string             `mapstructure:"serverUrl"`
	ProductType  config.ProductType `mapstructure:"productType"`
}

type publishFailureData struct {
	Message     string             `mapstructure:"message"`
	ProductType config.ProductType `mapstructure:"productType"`
}

type publishDeployedFailureData struct {
	DashboardURL string `mapstructure:"dashboardUrl"`
	LogsURL      string `mapstructure:"logsUrl"`
	DirectURL    string `mapstructure:"url"`
}

func NewFromState(
	s *state.State,
	rInterpreter interpreters.RInterpreter,
	pythonInterpreter interpreters.PythonInterpreter,
	emitter events.Emitter,
	log logging.Logger,
) (Publisher, error) {
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

	// Select R package mapping strategy from config; default to lockfile-based
	packagesFromLibrary := false
	if s.Config != nil && s.Config.R != nil && s.Config.R.PackagesFromLibrary != nil {
		packagesFromLibrary = *s.Config.R.PackagesFromLibrary
	}
	lockfileOnly := !packagesFromLibrary
	packageManager, err := rPackageMapperFactory(s.Dir, rexec.Path, log, lockfileOnly, s.RepoOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to create R package mapper: %w", err)
	}

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

	helper := publishhelper.NewPublishHelper(s, log)

	serverPublisher, err := createServerPublisher(helper, emitter, log)
	if err != nil {
		return nil, err
	}

	return &defaultPublisher{
		log:                  log,
		emitter:              emitter,
		rPackageMapper:       packageManager,
		r:                    rexec.Path,
		python:               pyexec.Path,
		PublishHelper:        helper,
		serverPublisher:      serverPublisher,
		rPackagesFromLibrary: packagesFromLibrary,
	}, nil
}

func (p *defaultPublisher) GetDeployedContentID() (types.ContentID, bool) {
	if p.Target == nil || p.Target.ID == "" {
		return "", false
	}
	return p.Target.ID, true
}

func (p *defaultPublisher) IsDeployed() bool {
	_, ok := p.GetDeployedContentID()
	return ok
}

func (p *defaultPublisher) logAppInfo(w io.Writer, log logging.Logger, publishingErr error) {
	dashboardURL := p.Target.DashboardURL
	logsURL := p.Target.LogsURL
	directURL := p.Target.DirectURL
	if publishingErr != nil {
		if p.Target.ID == "" {
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
			"serverURL", p.Account.URL,
			"contentID", p.Target.ID,
		)
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Dashboard URL: ", dashboardURL)
		fmt.Fprintln(w, "Direct URL:    ", directURL)
	}
}

func (p *defaultPublisher) emitErrorEvents(err error) {
	agentErr, ok := err.(*types.AgentError)
	if !ok {
		agentErr = types.NewAgentError(types.ErrorUnknown, err, nil)
	}

	var data events.EventData

	mapstructure.Decode(publishFailureData{
		Message:     agentErr.Message,
		ProductType: p.Config.ProductType,
	}, &data)

	// Record the error in the deployment record
	if p.Target != nil {
		p.Target.Error = agentErr
		_, writeErr := p.WriteDeploymentRecord()
		if writeErr != nil {
			p.log.Warn("failed to write updated deployment record", "name", p.TargetName, "err", writeErr)
		}
		if p.IsDeployed() {
			mapstructure.Decode(publishDeployedFailureData{
				DashboardURL: p.Target.DashboardURL,
				LogsURL:      p.Target.LogsURL,
				DirectURL:    p.Target.DirectURL,
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

var rPackageMapperFactory = renv.NewPackageMapper

func (p *defaultPublisher) PublishDirectory() error {
	p.log.Info("Publishing from directory", logging.LogKeyOp, events.AgentOp, "path", p.Dir, "localID", p.State.LocalID)
	p.emitter.Emit(events.New(events.PublishOp, events.StartPhase, events.NoError, publishStartData{
		Server:      p.Account.URL,
		Title:       p.Config.Title,
		ProductType: p.Config.ProductType,
	}))
	p.log.Info("Starting deployment to server", "server", p.Account.URL)

	err := p.doPublish()
	p.logAppInfo(os.Stderr, p.log, err)
	if err != nil {
		p.emitErrorEvents(err)
		return err
	} else {
		p.emitter.Emit(events.New(events.PublishOp, events.SuccessPhase, events.NoError, publishSuccessData{
			DashboardURL: p.Target.DashboardURL,
			LogsURL:      p.Target.LogsURL,
			DirectURL:    p.Target.DirectURL,
			ServerURL:    p.Account.URL,
			ContentID:    p.Target.ID,
			ProductType:  p.Config.ProductType,
		}))
	}
	return nil
}

func (p *defaultPublisher) doPublish() error {
	contentID, wasPreviouslyDeployed := p.GetDeployedContentID()
	p.CreateDeploymentRecord()
	_, err := p.WriteDeploymentRecord()
	if err != nil {
		return err
	}

	if wasPreviouslyDeployed {
		p.log.Info("Updating deployment", "content_id", contentID)
		p.setContentInfo(p.serverPublisher.GetContentInfo(contentID))
	}

	manifest, err := p.createManifest()
	if err != nil {
		return err
	}

	err = p.serverPublisher.PreFlightChecks()
	if err != nil {
		return err
	}

	if !wasPreviouslyDeployed {
		// Create a new deployment; we will update it with details later.
		contentID, err = p.serverPublisher.CreateDeployment()
		if err != nil {
			return err
		}
		p.setContentInfo(p.serverPublisher.GetContentInfo(contentID))
	}

	bundleFile, err := p.createBundle(manifest)
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())

	err = p.serverPublisher.PublishToServer(contentID, bundleFile)
	if err != nil {
		return err
	}

	return nil
}

func (p *defaultPublisher) setContentInfo(info publishhelper.ContentInfo) {
	p.Target.ID = info.ContentID
	p.Target.DashboardURL = info.DashboardURL
	p.Target.DirectURL = info.DirectURL
	p.Target.LogsURL = info.LogsURL
}

func (p *defaultPublisher) logDeploymentVersions(log logging.Logger, manifest *bundles.Manifest) {
	var versions []interface{}

	if manifest.Platform != "" {
		versions = append(versions, "r", manifest.Platform)
	}

	if manifest.Python != nil && manifest.Python.Version != "" {
		versions = append(versions, "python", manifest.Python.Version)
	}

	if manifest.Quarto != nil && manifest.Quarto.Version != "" {
		versions = append(versions, "quarto", manifest.Quarto.Version)
	}

	if len(versions) > 0 {
		log.Info("Deployment using interpreters", versions...)
	}
}

func (p *defaultPublisher) CreateDeploymentRecord() {
	p.Target = &deployment.Deployment{}
	p.serverPublisher.UpdateState()
	p.Config.ForceProductTypeCompliance()

	// Initial deployment record doesn't know the files or
	// bundleID. These will be added after the
	// bundle upload.
	cfg := *p.Config

	created := ""
	var contentType contenttypes.ContentType

	if p.Target != nil {
		created = p.Target.CreatedAt
		contentType = p.Target.Type
		if contentType == "" || contentType == contenttypes.ContentTypeUnknown {
			contentType = cfg.Type
		}
	} else {
		created = time.Now().Format(time.RFC3339)
		contentType = cfg.Type
	}

	p.Target.Schema = schema.DeploymentSchemaURL
	p.Target.ServerType = p.Account.ServerType
	p.Target.ServerURL = p.Account.URL
	p.Target.ClientVersion = project.Version
	p.Target.Type = contentType
	p.Target.CreatedAt = created
	p.Target.ConfigName = p.ConfigName
	p.Target.Configuration = &cfg
}

func CancelDeployment(
	deploymentPath util.AbsolutePath,
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
