package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

// Simplified user structure common to all servers
type User struct {
	Id        types.UserID `json:"id"`
	Username  string       `json:"username"`
	FirstName string       `json:"first_name"`
	LastName  string       `json:"last_name"`
	Email     string       `json:"email"`
}

type APIClient interface {
	TestAuthentication() (*User, error)
	CreateDeployment(*ConnectContent) (types.ContentID, error)
	UpdateDeployment(types.ContentID, *ConnectContent) error
	SetEnvVars(types.ContentID, config.Environment) error
	UploadBundle(types.ContentID, io.Reader) (types.BundleID, error)
	DeployBundle(types.ContentID, types.BundleID) (types.TaskID, error)
	WaitForTask(taskID types.TaskID, log logging.Logger) error
	ValidateDeployment(types.ContentID) error
	CheckCapabilities(*config.Config) error
}
