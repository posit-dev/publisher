package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	connectpublisher "github.com/posit-dev/publisher/internal/publish/connect"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
	"os"
	"time"
)

type ServerPublisher interface {
	CreateDeployment() (contentID types.ContentID, err error)
	GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo
	PreFlightChecks() error
	PublishToServer(contentID types.ContentID, bundleFile *os.File) error
}

func (p *defaultPublisher) createServerPublisher() (ServerPublisher, error) {
	switch p.Account.ServerType {
	case server_type.ServerTypeConnect, server_type.ServerTypeSnowflake:
		client, err := clientFactory(p.Account, 2*time.Minute, p.emitter, p.log)
		if err != nil {
			return nil, err
		}
		return connectpublisher.NewServerPublisher(p.State, p.log, client, p.emitter, p.PublishHelper), nil
	default:
		return nil, fmt.Errorf("unsupported server type: %s", p.Account.ServerType)
	}
}
