package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"
	"fmt"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud_logs"
	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
)

func (c *ServerPublisher) getAuthorizationToken() (string, error) {
	request := &types.AuthorizationRequest{
		ResourceType: "log_channel",
		ResourceID:   c.content.NextRevision.PublishLogChannel,
		Permission:   "revision.logs:read",
	}
	response, err := c.client.GetAuthorization(request)
	if err != nil {
		return "", fmt.Errorf("failed to get authorization token: %w", err)
	}
	if !response.Authorized {
		return "", fmt.Errorf("not authorized to access log channel")
	}
	return response.Token, nil
}

func (c *ServerPublisher) watchLogs(ctx context.Context) error {
	authToken, err := c.getAuthorizationToken()
	if err != nil {
		return err
	}

	logsClient := connect_cloud_logs.NewConnectCloudLogsClient(c.Account.CloudEnvironment,
		c.content.NextRevision.PublishLogChannel,
		authToken,
		c.log)

	logLogger := c.log.WithArgs(logging.LogKeyOp, events.PublishWaitForDeploymentOp)
	err = logsClient.WatchLogs(ctx, logLogger)
	if err != nil {
		return fmt.Errorf("error watching logs: %w", err)
	}
	return nil
}
