package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/r3labs/sse/v2"

	"github.com/posit-dev/publisher/internal/api_client/auth"
	"github.com/posit-dev/publisher/internal/clients/http_client"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

const logLookback = 60 * time.Second

type ConnectCloudLogsClient struct {
	log    logging.Logger
	client *sse.Client
}

func getBaseURL(env types.CloudEnvironment) string {
	switch env {
	case types.CloudEnvironmentDevelopment:
		return "https://logs.dev.connect.posit.cloud"
	case types.CloudEnvironmentStaging:
		return "https://logs.staging.connect.posit.cloud"
	default:
		return "https://logs.connect.posit.cloud"
	}
}

func NewConnectCloudLogsClient(
	environment types.CloudEnvironment,
	logChannel string,
	accessToken string,
	log logging.Logger,
) LogsAPIClient {
	transport := http_client.NewTransport()
	clientAuth := auth.NewPlainAuthenticator(fmt.Sprintf("Bearer %s", accessToken))
	authTransport := http_client.NewAuthenticatedTransport(transport, clientAuth)

	// Start streaming logs from a minute ago to avoid missing any logs that may have been emitted before we connected.
	// Since log channels are unique per revision, we should not see logs from previous publishes.
	sortKeyGt := time.Now().Add(-logLookback).UnixNano()
	client := sse.NewClient(fmt.Sprintf("%s/v1/logs/%s/stream?sort_key__gt=%d", getBaseURL(environment), logChannel, sortKeyGt))
	client.Connection.Transport = authTransport
	return &ConnectCloudLogsClient{
		log:    log,
		client: client,
	}
}

func (c ConnectCloudLogsClient) WatchLogs(ctx context.Context, logLogger logging.Logger) error {
	events := make(chan *sse.Event)
	err := c.client.SubscribeChanWithContext(ctx, "", events)
	if err != nil {
		c.log.Error("failed to subscribe to log channel", "error", err)
	}
	c.log.Info("successfully subscribed to log channel")

	go func() {
		for {
			select {
			case <-ctx.Done():
				c.log.Debug("done watching logs")
				return
			case event := <-events:
				logsResponse := LogsResponse{}
				err := json.Unmarshal(event.Data, &logsResponse)
				if err != nil {
					c.log.Error("failed to unmarshal log event", "error", err)
					continue
				}

				for _, line := range logsResponse.Data {
					//if line.Type == LogTypeBuild {
					switch line.Level {
					case LogLevelDebug:
						logLogger.Debug(line.Message)
					case LogLevelError:
						logLogger.Error(line.Message)
					default:
						logLogger.Info(line.Message)
					}
					//}
				}
			}
		}
	}()
	return nil
}
