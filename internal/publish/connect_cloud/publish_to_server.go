package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"io"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	internal_types "github.com/posit-dev/publisher/internal/types"
)

type publishToServerSuccessData struct {
	ContentID string `mapstructure:"contentId"`
}

func (c *ServerPublisher) PublishToServer(contentID internal_types.ContentID, bundleReader io.Reader) error {
	// If we didn't create the content earlier in ServerPublisher, we need to update the content with the latest info
	if c.content == nil {
		op := events.PublishUpdateDeploymentOp

		base, err := c.getContentRequestBase()
		if err != nil {
			return internal_types.OperationError(op, err)
		}

		updateRequest := &types.UpdateContentRequest{
			ContentRequestBase: *base,
			ContentID:          contentID,
		}

		_, err = c.client.UpdateContent(updateRequest)
		if err != nil {
			return err
		}

		c.content, err = c.client.UpdateContentBundle(contentID)
		if err != nil {
			return err
		}
	}

	err := c.uploadBundle(bundleReader, contentID)
	if err != nil {
		return err
	}

	err = c.initiatePublish(contentID)
	if err != nil {
		return err
	}

	err = c.waitForRevision(contentID)
	if err != nil {
		return err
	}

	return nil
}
