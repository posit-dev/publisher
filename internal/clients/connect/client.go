package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
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
	TestAuthentication(logging.Logger) (*User, error)
	CreateDeployment(*ConnectContent, logging.Logger) (types.ContentID, error)
	UpdateDeployment(types.ContentID, *ConnectContent, logging.Logger) error
	SetEnvVars(types.ContentID, config.Environment, logging.Logger) error
	UploadBundle(types.ContentID, io.Reader, logging.Logger) (types.BundleID, error)
	DeployBundle(types.ContentID, types.BundleID, logging.Logger) (types.TaskID, error)
	WaitForTask(taskID types.TaskID, log logging.Logger) error
	ValidateDeployment(types.ContentID, logging.Logger) error
	CheckCapabilities(util.AbsolutePath, *config.Config, logging.Logger) error
}
