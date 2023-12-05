package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

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
	CreateDeployment(*ConnectContent) (types.ContentID, error)
	UpdateDeployment(types.ContentID, *ConnectContent) error
	SetEnvVars(types.ContentID, config.Environment) error
	UploadBundle(types.ContentID, io.Reader) (types.BundleID, error)
	DeployBundle(types.ContentID, types.BundleID) (types.TaskID, error)
	WaitForTask(taskID types.TaskID, log logging.Logger) error
	ValidateDeployment(types.ContentID) error
}
