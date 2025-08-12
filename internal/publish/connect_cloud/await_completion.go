package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/logging"
	internaltypes "github.com/posit-dev/publisher/internal/types"
)

const (
	// pollInterval is the time between polls when waiting for revision publish to complete
	pollInterval = 1 * time.Second
)

var sleep = time.Sleep

func (c *ServerPublisher) awaitCompletion(log logging.Logger, op internaltypes.Operation) error {
	// Get the revision ID to monitor for completion
	revisionID := c.content.NextRevision.ID

	// Wait for publish to complete by polling the revision status
	log.Info("Waiting for publish to complete", "revision_id", revisionID)

	for {
		revision, err := c.client.GetRevision(revisionID)
		if err != nil {
			return internaltypes.OperationError(op, fmt.Errorf("failed to get revision status: %w", err))
		}

		// Check if publish has completed (success or failure)
		if revision.PublishResult != "" {
			if revision.PublishResult == types.PublishResultFailure {
				return internaltypes.OperationError(op, fmt.Errorf("publish failed: %s", revision.PublishErrorCode))
			}

			// Success case
			log.Info("Publish completed successfully")
			return nil
		}

		// Wait before polling again
		sleep(pollInterval)
	}
}
