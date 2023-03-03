package clients

import (
	"connect-client/apitypes"
	"io"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ContentName string
type ContentID string
type BundleID string
type TaskID string
type UserID string

// Simplified user structure common to all servers
type User struct {
	Id        UserID
	Username  string
	FirstName string
	LastName  string
	Email     string
}

// Simplified task structure common to all servers
type Task struct {
	Finished   bool
	Output     []string
	Error      string
	TotalLines int32
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() (*User, error)
	CreateDeployment(name ContentName, title apitypes.NullString) (ContentID, error)
	UploadBundle(ContentID, io.Reader) (BundleID, error)
	DeployBundle(ContentID, BundleID) (TaskID, error)
	GetTask(TaskID, *Task) (*Task, error)
}
