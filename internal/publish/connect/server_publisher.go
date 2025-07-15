package connect

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"io"
)

type ServerPublisher struct {
	*state.State
	log     logging.Logger
	emitter events.Emitter
	client  connect.APIClient
	helper  *publishhelper.PublishHelper
}

func NewServerPublisher(
	state *state.State,
	log logging.Logger,
	client connect.APIClient,
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

func (c *ServerPublisher) GetContentInfo(contentID types.ContentID) publishhelper.ContentInfo {
	return publishhelper.ContentInfo{
		ContentID:    contentID,
		DashboardURL: util.GetDashboardURL(c.helper.Account.URL, contentID),
		DirectURL:    util.GetDirectURL(c.helper.Account.URL, contentID),
		LogsURL:      util.GetLogsURL(c.helper.Account.URL, contentID),
	}
}

func (c *ServerPublisher) PublishToServer(contentID types.ContentID, bundleReader io.Reader) error {
	var err error

	bundleID, err := c.uploadBundle(bundleReader, contentID)
	if err != nil {
		return err
	}

	err = c.updateContent(contentID)
	if err != nil {
		return err
	}

	err = c.setEnvVars(contentID)
	if err != nil {
		return err
	}

	taskID, err := c.deployBundle(contentID, bundleID)
	if err != nil {
		return err
	}

	taskLogger := c.log.WithArgs("source", "server.log")
	err = c.client.WaitForTask(taskID, taskLogger)
	if err != nil {
		return err
	}

	if c.Config.Validate {
		err = c.validateContent(contentID)
		if err != nil {
			return err
		}
	}
	return nil
}
