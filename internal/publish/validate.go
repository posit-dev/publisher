package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type validateStartData struct {
	DirectURL string `mapstructure:"url"`
}

type validateSuccessData struct{}

func (p *defaultPublisher) validateContent(
	client connect.APIClient,
	contentID types.ContentID) error {

	op := events.PublishValidateDeploymentOp
	log := p.log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, validateStartData{
		DirectURL: getDirectURL(p.Account.URL, p.Target.ID),
	}))
	log.Info("Validating Deployment")

	err := client.ValidateDeployment(contentID, log)
	if err != nil {
		return types.OperationError(op, err)
	}

	log.Info("Done validating deployment")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, validateSuccessData{}))
	return nil
}
