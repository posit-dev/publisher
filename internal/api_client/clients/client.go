package clients

import (
	"io"

	"github.com/rstudio/connect-client/internal/apitypes"
	"github.com/rstudio/connect-client/internal/state"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ContentName string
type ContentID string
type BundleID string
type TaskID string
type UserID string

// Simplified user structure common to all servers
type User struct {
	Id        apitypes.UserID
	Username  string
	FirstName string
	LastName  string
	Email     string
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() (*User, error)
	CreateDeployment(state.ConnectContent) (apitypes.ContentID, error)
	UploadBundle(apitypes.ContentID, io.Reader) (apitypes.BundleID, error)
	DeployBundle(apitypes.ContentID, apitypes.BundleID) (apitypes.TaskID, error)
	WaitForTask(taskID apitypes.TaskID, logWriter io.Writer) error
}

// PublishingClient provides higher-level client methods that work
// on any type of publishing server, using the APIClient to abstract
// any details of specific server types.
type PublishingClient struct {
	APIClient
}
