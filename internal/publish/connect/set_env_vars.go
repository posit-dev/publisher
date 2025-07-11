package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"maps"

	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type setEnvVarsStartData struct{}
type setEnvVarsSuccessData struct{}

func (c *ServerPublisher) setEnvVars(contentID types.ContentID) error {
	env := c.Config.Environment
	secrets := c.Secrets
	if len(env) == 0 && len(secrets) == 0 {
		return nil
	}

	op := events.PublishSetEnvVarsOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, setEnvVarsStartData{}))
	log.Info("Setting environment variables")

	for name, value := range env {
		log.Info("Setting environment variable", "name", name, "value", value)
	}

	for name := range secrets {
		log.Info("Setting secret as environment variable", "name", name)
	}

	// Combine env and secrets into one environment for Connect
	combinedEnv := make(map[string]string)
	maps.Copy(combinedEnv, env)
	maps.Copy(combinedEnv, secrets)

	err := c.client.SetEnvVars(contentID, combinedEnv, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Info("Done setting environment variables")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, setEnvVarsSuccessData{}))
	return nil
}
