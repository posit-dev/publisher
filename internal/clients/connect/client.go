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

// LicenseInfo and ServerSettings represent the currently relevant
// subset of the information returned by the Connect server settings API.
// Additional fields may be added in the future as needed. See
// src/connect/api/serversettings/serversettings.go in the Connect source
// repository for the full set of fields.

type LicenseInfo struct {
	// OAuthIntegrations specifies if an installation is allowed to use
	// OAuth integrations to support viewer-based auth.
	OAuthIntegrations bool `json:"oauth-integrations"`
}

type ServerSettings struct {
	// License contains information about the capabilities allowed by the
	// in-use product license.
	License LicenseInfo `json:"license"`

	// OAuthIntegrationsEnabled indicates whether the ability to include oAuth integrations is enabled.
	OAuthIntegrationsEnabled bool `json:"oauth_integrations_enabled"`
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
	GetServerSettings(logging.Logger) (*ServerSettings, error)
}
