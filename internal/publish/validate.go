package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type validateStartData struct {
	DirectURL string `mapstructure:"url"`
}

type validateSuccessData struct{}

func (p *defaultPublisher) validateContent(
	client connect.APIClient,
	contentID types.ContentID,
	log logging.Logger) error {

	op := events.PublishValidateDeploymentOp
	log = log.WithArgs(logging.LogKeyOp, op)

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
