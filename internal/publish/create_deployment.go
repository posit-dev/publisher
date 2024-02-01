package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type createDeploymentStartData struct{}
type createDeploymentSuccessData struct {
	ContentID types.ContentID
	SaveName  string
}

func (p *defaultPublisher) createDeployment(client connect.APIClient, log logging.Logger) (types.ContentID, error) {
	op := events.PublishCreateNewDeploymentOp
	log = log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createDeploymentStartData{}))
	log.Info("Creating new deployment")

	contentID, err := client.CreateDeployment(&connect.ConnectContent{}, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createDeploymentSuccessData{
		ContentID: contentID,
		SaveName:  p.SaveName,
	}))
	log.Info("Created deployment", "content_id", contentID, "save_name", p.SaveName)
	return contentID, nil
}
