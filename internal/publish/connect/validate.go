package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type validateStartData struct {
	DirectURL string `mapstructure:"url"`
}

type validateSuccessData struct{}

func (c *ServerPublisher) validateContent(
	contentID types.ContentID) error {

	op := events.PublishValidateDeploymentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, validateStartData{
		DirectURL: util.GetDirectURL(c.Account.URL, c.Target.ID),
	}))
	log.Info("Validating Deployment")

	err := c.client.ValidateDeployment(contentID, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Info("Done validating deployment")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, validateSuccessData{}))
	return nil
}
