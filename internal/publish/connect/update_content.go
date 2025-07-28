package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"

	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type updateContentStartData struct {
	ContentID types.ContentID `mapstructure:"contentId"`
	SaveName  string          `mapstructure:"saveName"`
}
type updateContentSuccessData struct{}

type DeploymentNotFoundErrorDetails struct {
	ContentID types.ContentID `mapstructure:"contentId"`
}

func (c *ServerPublisher) updateContent(
	contentID types.ContentID) error {

	op := events.PublishUpdateDeploymentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, updateContentStartData{
		ContentID: contentID,
		SaveName:  c.SaveName,
	}))
	log.Info("Updating deployment settings", "content_id", contentID, "save_name", c.SaveName)

	connectContent := connect.ConnectContentFromConfig(c.Config)
	err := c.client.UpdateDeployment(contentID, connectContent, log)
	if err != nil {
		httpErr, ok := err.(*http_client.HTTPError)
		if ok && httpErr.Status == http.StatusNotFound {
			details := DeploymentNotFoundErrorDetails{
				ContentID: contentID,
			}
			return types.NewAgentError(events.DeploymentNotFoundCode, err, details)
		} else {
			return types.OperationError(op, err)
		}
	}

	log.Info("Done updating settings")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, updateContentSuccessData{}))
	return nil
}
