package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"
	"io"
	"time"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	internal_types "github.com/posit-dev/publisher/internal/types"
)

type publishContentData struct {
	ContentID internal_types.ContentID `mapstructure:"contentId"`
}

func (c *ServerPublisher) updateContent(contentID internal_types.ContentID) error {
	// If we didn't create the content earlier in ServerPublisher, we need to update the content with the latest info
	if c.content == nil {
		op := events.PublishUpdateContentOp
		data := publishContentData{ContentID: contentID}
		log := c.log.WithArgs(logging.LogKeyOp, op)
		c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, data))
		log.Info("Determining content settings")

		base, err := c.getContentRequestBase(false)
		if err != nil {
			return internal_types.OperationError(op, err)
		}

		updateRequest := &types.UpdateContentRequest{
			ContentRequestBase: *base,
			ContentID:          contentID,
		}

		log.Info("Updating content settings")
		_, err = c.client.UpdateContent(updateRequest)
		if err != nil {
			return err
		}

		c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, data))
		log.Info("Updated content settings")
	}
	return nil
}

func (c *ServerPublisher) PublishToServer(contentID internal_types.ContentID, bundleReader io.Reader) error {
	err := c.updateContent(contentID)
	if err != nil {
		return err
	}

	op := events.PublishDeployContentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)
	data := publishContentData{
		ContentID: contentID,
	}

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, data))

	err = c.initiatePublish(log, op, contentID)
	if err != nil {
		return err
	}

	err = c.uploadBundle(bundleReader)
	if err != nil {
		return err
	}
	log.Info("Getting content logs...")

	// refetch the content to get the new revision's log channel
	content, err := c.client.GetContent(c.content.ID)
	if err != nil {
		return err
	}
	c.content = content

	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		go func() {
			// Allow up to 5 seconds for logs to flush before cancelling.
			// Needs goroutine to avoid blocking the completion of the deployment.
			time.Sleep(5 * time.Second)
			cancel()
		}()
	}()
	err = c.watchLogs(ctx, op)
	if err != nil {
		return err
	}

	err = c.awaitCompletion(log, op)
	if err != nil {
		return err
	}

	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, data))

	return nil
}
