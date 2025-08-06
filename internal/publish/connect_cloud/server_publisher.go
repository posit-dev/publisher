package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
)

type ServerPublisher struct {
	*state.State
	log     logging.Logger
	emitter events.Emitter
	client  connect_cloud.APIClient
	helper  *publishhelper.PublishHelper
	content *clienttypes.ContentResponse // Store content response for use across methods
}

func NewServerPublisher(
	state *state.State,
	log logging.Logger,
	client connect_cloud.APIClient,
	emitter events.Emitter,
	helper *publishhelper.PublishHelper) *ServerPublisher {
	return &ServerPublisher{
		State:   state,
		log:     log,
		emitter: emitter,
		client:  client,
		helper:  helper,
	}
}

func (c *ServerPublisher) UpdateState() {
	// These fields are required by the schema
	c.Target.ConnectCloud = &deployment.ConnectCloud{
		AccountName: c.Account.CloudAccountName,
	}

	// These fields are disallowed by the schema
	if c.Config.Python != nil {
		c.Config.Python.PackageManager = ""
		c.Config.Python.PackageFile = ""
		c.Config.Python.RequiresPythonVersion = ""

		// Connect Cloud requires Python version to be in the format "X.Y"
		pythonVersionSplit := strings.Split(c.Config.Python.Version, ".")
		c.Config.Python.Version = fmt.Sprintf("%s.%s", pythonVersionSplit[0], pythonVersionSplit[1])
	}
	if c.Config.R != nil {
		c.Config.R.PackageManager = ""
		c.Config.R.PackageFile = ""
		c.Config.R.RequiresRVersion = ""
	}
}

func getCloudUIURL(env types.CloudEnvironment) string {
	switch env {
	case types.CloudEnvironmentDevelopment:
		return "https://dev.connect.posit.cloud"
	case types.CloudEnvironmentStaging:
		return "https://staging.connect.posit.cloud"
	default:
		return "https://connect.posit.cloud"
	}
}

func getCloudDirectURL(env types.CloudEnvironment, contentID types.ContentID) string {
	switch env {
	case types.CloudEnvironmentDevelopment:
		return fmt.Sprintf("https://%s.share.dev.connect.posit.cloud", contentID)
	case types.CloudEnvironmentStaging:
		return fmt.Sprintf("https://%s.share.staging.connect.posit.cloud", contentID)
	default:
		return fmt.Sprintf("https://%s.share.connect.posit.cloud", contentID)
	}
}

// GetContentInfo returns a ContentInfo struct with URLs for the Connect Cloud dashboard,
// direct content access, and logs
func (c *ServerPublisher) GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo {
	uiBaseURL := getCloudUIURL(c.helper.Account.CloudEnvironment)
	dashboardURL := fmt.Sprintf("%s/%s/content/%s", uiBaseURL, c.helper.Account.CloudAccountName, contentID)
	directURL := getCloudDirectURL(c.helper.Account.CloudEnvironment, contentID)
	logsURL := fmt.Sprintf("%s/history", dashboardURL)
	return publishhelper.ContentInfo{
		ContentID:    contentID,
		DashboardURL: dashboardURL,
		DirectURL:    directURL,
		LogsURL:      logsURL,
	}
}
