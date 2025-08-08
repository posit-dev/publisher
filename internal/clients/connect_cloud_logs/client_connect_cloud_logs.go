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

// ConnectCloudLogsClient is a client for the Connect Cloud Logs API.
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

// NewConnectCloudLogsClient creates a new ConnectCloudLogsClient with authentication.
func NewConnectCloudLogsClient(
	environment types.CloudEnvironment,
	logChannel string,
	accessToken string,
	log logging.Logger,
) LogsAPIClient {
	transport := http_client.NewTransport()
	clientAuth := auth.NewPlainAuthenticator(fmt.Sprintf("Bearer %s", accessToken))
	authTransport := http_client.NewAuthenticatedTransport(transport, clientAuth)

	//client := sse.NewClient(fmt.Sprintf("%s/v1/logs/%s?previous_n=100", getBaseURL(environment), logChannel))
	// 5 seconds ago
	sortKeyGt := time.Now().Add(-5 * time.Second).UnixNano()
	client := sse.NewClient(fmt.Sprintf("%s/v1/logs/%s/stream?sort_key__gt=%d", getBaseURL(environment), logChannel, sortKeyGt))
	client.Connection.Transport = authTransport
	return &ConnectCloudLogsClient{
		log:    log,
		client: client,
	}
}

func (c ConnectCloudLogsClient) WatchLogs(ctx context.Context, logLogger logging.Logger) error {
	events := make(chan *sse.Event)
	go func() {
		err := c.client.SubscribeChanWithContext(ctx, "", events)
		if err != nil {
			c.log.Error("failed to subscribe to log channel", "error", err)
		}
		c.log.Info("successfully subscribed to log channel")
	}()

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
					if line.Type == LogTypeBuild {
						switch line.Level {
						case LogLevelDebug:
							logLogger.Debug(line.Message)
						case LogLevelError:
							logLogger.Error(line.Message)
						default:
							logLogger.Info(line.Message)
						}
					}
				}
			}
		}
	}()
	return nil
}
