package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type deployBundleStartData struct{}
type deployBundleSuccessData struct {
}

func (c *ServerPublisher) initiatePublish(contentID types.ContentID) error {
	op := events.PublishDeployBundleOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, deployBundleStartData{}))
	log.Info("Initiating publish of content")

	err := c.client.PublishContent(string(contentID))
	if err != nil {
		return types.OperationError(op, fmt.Errorf("content publish failed: %w", err))
	}

	log.Info("Publish initiated")
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, deployBundleSuccessData{}))
	return nil
}
