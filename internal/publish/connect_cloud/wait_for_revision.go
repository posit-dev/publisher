package connect_cloud

import (
	"fmt"
	"time"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	internaltypes "github.com/posit-dev/publisher/internal/types"
)

const (
	// pollInterval is the time between polls when waiting for revision publish to complete
	pollInterval = 1 * time.Second
	// maxPollTime is the maximum time to poll for revision publish to complete (5 minutes)
	maxPollTime = 5 * time.Minute
)

func (c *ServerPublisher) waitForRevision(contentID internaltypes.ContentID) error {
	op := events.PublishWaitForDeploymentOp
	log := c.log.WithArgs(logging.LogKeyOp, op)

	// Get the revision ID to monitor for completion
	revisionID := c.content.NextRevision.ID
	if revisionID == "" {
		return internaltypes.OperationError(op, fmt.Errorf("no revision ID found in content response"))
	}

	// Wait for publish to complete by polling the revision status
	log.Info("Waiting for publish to complete", "revision_id", revisionID)

	startTime := time.Now()
	for time.Since(startTime) < maxPollTime {
		revision, err := c.client.GetRevision(revisionID)
		if err != nil {
			return internaltypes.OperationError(op, fmt.Errorf("failed to get revision status: %w", err))
		}

		// Check if publish has completed (success or failure)
		if revision.PublishResult != "" {
			if revision.PublishResult == types.PublishResultFailure {
				errorMsg := fmt.Sprintf("publish failed: %s", revision.PublishErrorCode)
				return internaltypes.OperationError(op, fmt.Errorf(errorMsg))
			}

			// Success case
			log.Info("Publish completed successfully")
			c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, publishToServerSuccessData{
				ContentID: string(contentID),
			}))
			return nil
		}

		// Wait before polling again
		time.Sleep(pollInterval)
	}

	return internaltypes.OperationError(op, fmt.Errorf("timed out waiting for publish to complete after %s", maxPollTime))
}
