package connect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"time"

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

type Integration struct {
	Guid        types.GUID     `json:"guid"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	AuthType    string         `json:"auth_type"`
	Template    string         `json:"template"`
	Config      map[string]any `json:"config"`
	CreatedTime time.Time      `json:"created_time"`
}

type APIClient interface {
	TestAuthentication(logging.Logger) (*User, error)
	ContentDetails(contentID types.ContentID, body *ConnectContent, log logging.Logger) error
	CreateDeployment(*ConnectContent, logging.Logger) (types.ContentID, error)
	UpdateDeployment(types.ContentID, *ConnectContent, logging.Logger) error
	GetEnvVars(types.ContentID, logging.Logger) (*types.Environment, error)
	SetEnvVars(types.ContentID, config.Environment, logging.Logger) error
	UploadBundle(types.ContentID, io.Reader, logging.Logger) (types.BundleID, error)
	DeployBundle(types.ContentID, types.BundleID, logging.Logger) (types.TaskID, error)
	WaitForTask(taskID types.TaskID, log logging.Logger) error
	ValidateDeployment(types.ContentID, logging.Logger) error
	CheckCapabilities(util.AbsolutePath, *config.Config, *types.ContentID, logging.Logger) error
	GetCurrentUser(logging.Logger) (*User, error)
	GetIntegrations(logging.Logger) ([]Integration, error)
	GetSettings(util.AbsolutePath, *config.Config, logging.Logger) (*AllSettings, error)
	LatestBundleID(types.ContentID, logging.Logger) (types.BundleID, error)
	DownloadBundle(types.ContentID, types.BundleID, logging.Logger) ([]byte, error)
}
