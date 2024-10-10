package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type deployBundleStartData struct{}
type deployBundleSuccessData struct {
	TaskID types.TaskID `mapstructure:"taskId"`
}

func (p *defaultPublisher) deployBundle(
	client connect.APIClient,
	contentID types.ContentID,
	bundleID types.BundleID) (types.TaskID, error) {

	op := events.PublishDeployBundleOp
	log := p.log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, deployBundleStartData{}))
	log.Info("Activating Deployment")

	taskID, err := client.DeployBundle(contentID, bundleID, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	log.Info("Activation requested")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, deployBundleSuccessData{
		TaskID: taskID,
	}))
	return taskID, nil
}
