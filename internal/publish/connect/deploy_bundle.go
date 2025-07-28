package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type deployBundleStartData struct{}
type deployBundleSuccessData struct {
	TaskID types.TaskID `mapstructure:"taskId"`
}

func (c *ServerPublisher) deployBundle(
	contentID types.ContentID,
	bundleID types.BundleID) (types.TaskID, error) {

	op := events.PublishDeployBundleOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, deployBundleStartData{}))
	log.Info("Activating Deployment")

	taskID, err := c.client.DeployBundle(contentID, bundleID, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	log.Info("Activation requested")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, deployBundleSuccessData{
		TaskID: taskID,
	}))
	return taskID, nil
}
