package connect

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type checkConfigurationStartData struct{}
type checkConfigurationSuccessData struct{}

func (c *ServerPublisher) PreFlightChecks() error {
	op := events.PublishCheckCapabilitiesOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, checkConfigurationStartData{}))
	log.Info("Checking configuration against server capabilities")

	user, err := c.client.TestAuthentication(log)
	if err != nil {
		return types.OperationError(op, err)
	}
	log.Info("Publishing with credentials", "username", user.Username, "email", user.Email)

	var existingContentID *types.ContentID
	if c.Target != nil {
		existingContentID = &c.Target.ID
	}

	err = c.client.CheckCapabilities(c.Dir, c.Config, existingContentID, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Info("Configuration OK")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, checkConfigurationSuccessData{}))
	return nil
}
