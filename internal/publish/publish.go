package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/project"
	connectpublisher "github.com/posit-dev/publisher/internal/publish/connect"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/schema"

	//connect_publisher "github.com/posit-dev/publisher/internal/publish/connect"
	"io"
	"maps"
	"os"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/posit-dev/publisher/internal/bundles"
	connectclient "github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type Publisher interface {
	PublishDirectory() error
}

type defaultPublisher struct {
	//*state.State
	log            logging.Logger
	emitter        events.Emitter
	rPackageMapper renv.PackageMapper
	r              util.Path
	python         util.Path
	*publishhelper.PublishHelper
}

type createBundleStartData struct{}
type createBundleSuccessData struct {
	Filename string `mapstructure:"filename"`
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

	helper := publishhelper.NewPublishHelper(s, log)

	return &defaultPublisher{
		log:            log,
		emitter:        emitter,
		rPackageMapper: packageManager,
		r:              rexec.Path,
		python:         pyexec.Path,
		PublishHelper:  helper,
	}, err
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
		Message: agentErr.Message,
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

var clientFactory = connectclient.NewConnectClient

func (p *defaultPublisher) PublishDirectory() error {
	p.log.Info("Publishing from directory", logging.LogKeyOp, events.AgentOp, "path", p.Dir, "localID", p.State.LocalID)
	p.emitter.Emit(events.New(events.PublishOp, events.StartPhase, events.NoError, publishStartData{
		Server: p.Account.URL,
		Title:  p.Config.Title,
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

	err = p.configureInterpreters()
	if err != nil {
		return err
	}

	client, err := clientFactory(p.Account, 2*time.Minute, p.emitter, p.log)
	if err != nil {
		return err
	}
	serverPublisher := connectpublisher.NewServerPublisher(p.State, p.log, client, nil, p.emitter, p.PublishHelper)

	if wasPreviouslyDeployed {
		p.log.Info("Updating deployment", "content_id", contentID)
	} else {
		// Create a new deployment; we will update it with details later.
		contentID, err = serverPublisher.CreateDeployment()
		if err != nil {
			return err
		}
	}

	p.setContentInfo(serverPublisher.GetContentInfo(contentID))

	err = serverPublisher.PreFlightChecks()
	if err != nil {
		return err
	}

	bundleFile, err := p.createBundle()
	if err != nil {
		return err
	}
	defer bundleFile.Close()
	defer os.Remove(bundleFile.Name())

	err = serverPublisher.PublishToServer(contentID, bundleFile)
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

func (p *defaultPublisher) CreateDeploymentRecord() {
	p.Target = &deployment.Deployment{}

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

	p.Target.Schema = schema.DeploymentSchemaURL
	p.Target.ServerType = p.Account.ServerType
	p.Target.ServerURL = p.Account.URL
	p.Target.ClientVersion = project.Version
	p.Target.Type = contentType
	p.Target.CreatedAt = created
	p.Target.ConfigName = p.ConfigName
	p.Target.Configuration = &cfg
}

func (p *defaultPublisher) configureInterpreters() error {
	if p.Config.Python != nil {
		filename := p.Config.Python.PackageFile
		if filename == "" {
			filename = interpreters.PythonRequirementsFilename
		}
		p.log.Debug("Python configuration present", "PythonRequirementsFile", filename)

		requirements, err := pydeps.ReadRequirementsFile(p.Dir.Join(filename))
		p.log.Debug("Python requirements file in use", "requirements", requirements)
		if err != nil {
			return err
		}
		p.Target.Requirements = requirements
	}

	if p.Config.R != nil {
		filename := p.Config.R.PackageFile
		if filename == "" {
			filename = interpreters.DefaultRenvLockfile
		}
		p.log.Debug("R configuration present", "filename", filename)
		lockfile, err := renv.ReadLockfile(p.Dir.Join(filename))
		if err != nil {
			return err
		}
		p.log.Debug("Renv lockfile in use", "lockfile", lockfile)
		p.Target.Renv = lockfile
	}

	return nil
}

func (p *defaultPublisher) createBundle() (*os.File, error) {
	manifest := bundles.NewManifestFromConfig(p.Config)
	p.log.Debug("Built manifest from config", "config", p.ConfigName)

	if p.Config.R != nil {
		rPackages, err := p.getRPackages()
		if err != nil {
			return nil, err
		}
		manifest.Packages = rPackages
	}
	p.log.Debug("Generated manifest:", manifest)

	// Create Bundle step
	op := events.PublishCreateBundleOp
	prepareLog := p.log.WithArgs(logging.LogKeyOp, op)

	bundler, err := bundles.NewBundler(p.Dir, manifest, p.Config.Files, p.log)
	if err != nil {
		return nil, err
	}

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createBundleStartData{}))
	prepareLog.Info("Preparing files")
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return nil, types.OperationError(op, err)
	}
	manifest, err = bundler.CreateBundle(bundleFile)
	if err != nil {
		return nil, types.OperationError(op, err)
	}

	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return nil, types.OperationError(op, err)
	}
	prepareLog.Info("Done preparing files", "filename", bundleFile.Name())
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createBundleSuccessData{
		Filename: bundleFile.Name(),
	}))

	// Update deployment record with new information
	p.Target.Files = manifest.GetFilenames()

	return bundleFile, nil
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
