package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type setEnvVarsStartData struct{}
type setEnvVarsSuccessData struct{}

func (p *defaultPublisher) setEnvVars(
	client connect.APIClient,
	contentID types.ContentID,
	log logging.Logger) error {

	env := p.Config.Environment
	if len(env) == 0 {
		return nil
	}

	op := events.PublishSetEnvVarsOp
	log = log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, setEnvVarsStartData{}))
	log.Info("Setting environment variables")

	for name, value := range env {
		log.Info("Setting environment variable", "name", name, "value", value)
	}
	err := client.SetEnvVars(contentID, env, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, setEnvVarsSuccessData{}))
	log.Info("Done setting environment variables")
	return nil
}
