package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

// LogsAPIClient defines the interface for the Connect Cloud Logs API.
type LogsAPIClient interface {
	// GetLogs retrieves logs for a specific log channel.
	GetLogs(logChannel string) (*LogsResponse, error)
}
