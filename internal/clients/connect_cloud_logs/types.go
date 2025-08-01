package connect_cloud_logs

// Copyright (C) 2025 by Posit Software, PBC.

// LogType represents the type of log message.
type LogType string

const (
	// LogTypeBuild represents build-time log messages.
	LogTypeBuild LogType = "build"
	// LogTypeRuntime represents runtime log messages.
	LogTypeRuntime LogType = "runtime"
)

// LogMessage represents a single log message.
type LogMessage struct {
	Timestamp int64   `json:"timestamp"`
	SortKey   int64   `json:"sort_key"`
	Message   string  `json:"message"`
	Type      LogType `json:"type"`
	Level     string  `json:"level"`
}

// LogsResponse represents a response containing a collection of log messages.
type LogsResponse struct {
	Data []LogMessage `json:"data"`
}
