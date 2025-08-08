package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"time"

	connectclient "github.com/posit-dev/publisher/internal/clients/connect"
	connectcloudclient "github.com/posit-dev/publisher/internal/clients/connect_cloud"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	connectpublisher "github.com/posit-dev/publisher/internal/publish/connect"
	connectcloudpublisher "github.com/posit-dev/publisher/internal/publish/connect_cloud"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
)

// Factories for API clients
var connectClientFactory = connectclient.NewConnectClient
var cloudClientFactory = connectcloudclient.NewConnectCloudClientWithAuth

type ServerPublisher interface {
	UpdateState()
	CreateDeployment() (contentID types.ContentID, err error)
	GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo
	PreFlightChecks() error
	PublishToServer(contentID types.ContentID, bundleReader io.Reader) error
}

var _ ServerPublisher = (*connectpublisher.ServerPublisher)(nil)
var _ ServerPublisher = (*connectcloudpublisher.ServerPublisher)(nil)

func createServerPublisher(ph *publishhelper.PublishHelper, emitter events.Emitter, log logging.Logger) (ServerPublisher, error) {
	switch ph.Account.ServerType {
	case server_type.ServerTypeConnect, server_type.ServerTypeSnowflake:
		client, err := connectClientFactory(ph.Account, 2*time.Minute, emitter, log)
		if err != nil {
			return nil, err
		}
		return connectpublisher.NewServerPublisher(ph.State, log, client, emitter, ph), nil
	case server_type.ServerTypeConnectCloud:
		// For Connect Cloud, we need to create a different client
		client := cloudClientFactory(ph.Account.CloudEnvironment, log, 2*time.Minute, ph.Account.CloudAccessToken)
		return connectcloudpublisher.NewServerPublisher(ph.State, log, client, emitter, ph), nil
	default:
		return nil, fmt.Errorf("unsupported server type: %s", ph.Account.ServerType)
	}
}
