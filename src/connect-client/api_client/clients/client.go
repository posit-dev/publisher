package clients

// Copyright (C) 2023 by Posit Software, PBC.

type ContentID string
type BundleID string
type TaskID string

// Simplified user structure common to all servers
type User struct {
	Id        string
	Username  string
	FirstName string
	LastName  string
	Email     string
}

// Simplified task structure common to all servers
type Task struct {
	Finished bool
	Output   []string
	Error    string
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() (*User, error)
	CreateDeployment() (ContentID, error)
	// DeployBundle(ContentID, io.Reader) (BundleID, TaskID, error)
	GetTask(TaskID) (*Task, error)
}
