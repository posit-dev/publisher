package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type deployBundleStartData struct{}
type deployBundleSuccessData struct{}

func (p *defaultPublisher) deployBundle(
	client connect.APIClient,
	contentID types.ContentID,
	bundleID types.BundleID,
	log logging.Logger) (types.TaskID, error) {

	op := events.PublishDeployBundleOp
	log = log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, deployBundleStartData{}))
	log.Info("Activating Deployment")

	taskID, err := client.DeployBundle(contentID, bundleID, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	log.Info("Activation requested")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, deployBundleSuccessData{}))
	return taskID, nil
}
