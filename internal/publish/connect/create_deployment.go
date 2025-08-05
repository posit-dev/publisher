package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type createDeploymentStartData struct {
	SaveName string `mapstructure:"saveName"`
}

type createDeploymentSuccessData struct {
	ContentID types.ContentID `mapstructure:"contentId"`
	SaveName  string          `mapstructure:"saveName"`
}

func (c *ServerPublisher) CreateDeployment() (types.ContentID, error) {
	op := events.PublishCreateNewDeploymentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createDeploymentStartData{
		SaveName: c.SaveName,
	}))
	log.Info("Creating new deployment")

	contentID, err := c.client.CreateDeployment(&connect.ConnectContent{}, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	log.Info("Created deployment", "content_id", contentID)
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createDeploymentSuccessData{
		ContentID: contentID,
		SaveName:  c.SaveName,
	}))

	return contentID, nil
}
