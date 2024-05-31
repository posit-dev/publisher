package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type checkConfigurationStartData struct{}
type checkConfigurationSuccessData struct{}

func (p *defaultPublisher) checkConfiguration(client connect.APIClient, log logging.Logger) error {
	op := events.PublishCheckCapabilitiesOp
	log = log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, checkConfigurationStartData{}))
	log.Info("Checking configuration against server capabilities")

	user, err := client.TestAuthentication(log)
	if err != nil {
		return types.OperationError(op, err)
	}
	log.Info("Publishing with credentials", "username", user.Username, "email", user.Email)

	err = client.CheckCapabilities(p.Dir, p.Config, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Info("Configuration OK")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, checkConfigurationSuccessData{}))
	return nil
}
