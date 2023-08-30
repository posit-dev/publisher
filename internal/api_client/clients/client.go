package clients

import (
	"io"

	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
)

// Copyright (C) 2023 by Posit Software, PBC.

type ContentName string
type ContentID string
type BundleID string
type TaskID string
type UserID string

// Simplified user structure common to all servers
type User struct {
	Id        types.UserID
	Username  string
	FirstName string
	LastName  string
	Email     string
}

type APIClient interface {
	TestConnection() error
	TestAuthentication() (*User, error)
	CreateDeployment(state.ConnectContent) (types.ContentID, error)
	UpdateDeployment(types.ContentID, state.ConnectContent) error
	UploadBundle(types.ContentID, io.Reader) (types.BundleID, error)
	DeployBundle(types.ContentID, types.BundleID) (types.TaskID, error)
	WaitForTask(taskID types.TaskID, log logging.Logger) error
}

// PublishingClient provides higher-level client methods that work
// on any type of publishing server, using the APIClient to abstract
// any details of specific server types.
type PublishingClient struct {
	APIClient
}
