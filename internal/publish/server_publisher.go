package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"time"

	connectpublisher "github.com/posit-dev/publisher/internal/publish/connect"
	connectcloudpublisher "github.com/posit-dev/publisher/internal/publish/connect_cloud"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
)

type ServerPublisher interface {
	CreateDeployment() (contentID types.ContentID, err error)
	GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo
	PreFlightChecks() error
	PublishToServer(contentID types.ContentID, bundleReader io.Reader) error
}

var _ ServerPublisher = (*connectpublisher.ServerPublisher)(nil)
var _ ServerPublisher = (*connectcloudpublisher.ServerPublisher)(nil)

func (p *defaultPublisher) createServerPublisher() (ServerPublisher, error) {
	switch p.Account.ServerType {
	case server_type.ServerTypeConnect, server_type.ServerTypeSnowflake:
		client, err := clientFactory(p.Account, 2*time.Minute, p.emitter, p.log)
		if err != nil {
			return nil, err
		}
		return connectpublisher.NewServerPublisher(p.State, p.log, client, p.emitter, p.PublishHelper), nil
	case server_type.ServerTypeConnectCloud:
		// For Connect Cloud, we need to create a different client
		client, err := cloudClientFactory(p.Account, 2*time.Minute, p.log)
		if err != nil {
			return nil, err
		}
		return connectcloudpublisher.NewServerPublisher(p.State, p.log, client, p.emitter, p.PublishHelper), nil
	default:
		return nil, fmt.Errorf("unsupported server type: %s", p.Account.ServerType)
	}
}
