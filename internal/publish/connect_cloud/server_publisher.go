package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
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

// getCloudUIURL transforms an API URL into the corresponding UI URL
// e.g., https://api.connect.posit.cloud -> https://connect.posit.cloud
func getCloudUIURL(apiURL string) string {
	return strings.Replace(apiURL, "api.", "", 1)
}

// GetContentInfo returns a ContentInfo struct with URLs for the Connect Cloud dashboard,
// direct content access, and logs
func (c *ServerPublisher) GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo {
	// Get the UI base URL from the API URL
	uiBaseURL := getCloudUIURL(c.helper.Account.URL)

	dashboardURL := fmt.Sprintf("%s/%s/content/%s", uiBaseURL, c.helper.Account.Name, contentID)
	// TODO: make this work for staging
	directURL := fmt.Sprintf("https://%s.share.connect.posit.cloud", contentID)
	logsURL := fmt.Sprintf("%s/logs", dashboardURL)

	return publishhelper.ContentInfo{
		ContentID:    contentID,
		DashboardURL: dashboardURL,
		DirectURL:    directURL,
		LogsURL:      logsURL,
	}
}
