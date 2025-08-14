package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func (c *ServerPublisher) initiatePublish(log logging.Logger, op types.Operation, contentID types.ContentID) error {
	log.Info("Initiating publish of content")

	err := c.client.PublishContent(string(contentID))
	if err != nil {
		return types.OperationError(op, fmt.Errorf("content publish failed: %w", err))
	}

	log.Info("Publish initiated")
	return nil
}
