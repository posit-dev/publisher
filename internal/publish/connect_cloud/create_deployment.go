package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	content_types "github.com/posit-dev/publisher/internal/types"
)

type createDeploymentStartData struct {
	SaveName string `mapstructure:"saveName"`
}

type createDeploymentSuccessData struct {
	ContentID content_types.ContentID `mapstructure:"contentId"`
	SaveName  string                  `mapstructure:"saveName"`
}

func (c *ServerPublisher) CreateDeployment() (content_types.ContentID, error) {
	op := events.PublishCreateNewDeploymentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createDeploymentStartData{
		SaveName: c.SaveName,
	}))
	log.Info("Creating new Connect Cloud deployment")

	// Create the content request
	contentRequest := &types.CreateContentRequest{
		ContentRequestBase: c.getContentRequestBase(),
		AccountID:          c.helper.Account.CloudAccountID,
	}

	// Call the Cloud API to create the content
	contentResponse, err := c.client.CreateContent(contentRequest)
	if err != nil {
		return "", content_types.OperationError(op, err)
	}

	// Store the content response for later use
	c.content = contentResponse

	contentID := content_types.ContentID(contentResponse.ID)
	log.Info("Created deployment", "content_id", contentID)

	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createDeploymentSuccessData{
		ContentID: contentID,
		SaveName:  c.SaveName,
	}))

	return contentID, nil
}
