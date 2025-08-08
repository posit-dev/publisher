package connect_cloud_logs

import (
	"context"

	"github.com/posit-dev/publisher/internal/logging"
)

// Copyright (C) 2025 by Posit Software, PBC.

// LogsAPIClient defines the interface for the Connect Cloud Logs API.
type LogsAPIClient interface {
	// WatchLogs retrieves logs for a specific log channel and logs them using the provided logger.
	WatchLogs(ctx context.Context, logLogger logging.Logger) error
}
