package clients

// Copyright (C) 2023 by Posit Software, PBC.

type ContentID string
type BundleID string
type TaskID string

// Simplified task structure common to all servers
type Task struct {
	Finished bool
	Output   []string
	Error    string
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() error
	CreateDeployment() (ContentID, error)
	// DeployBundle(ContentID, io.Reader) (BundleID, TaskID, error)
	GetTask(TaskID) (*Task, error)
}
