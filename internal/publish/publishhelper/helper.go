package publishhelper

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"time"
)

type PublishHelper struct {
	*state.State
	log logging.Logger
}

type ContentInfo struct {
	ContentID    types.ContentID
	DashboardURL string
	DirectURL    string
	LogsURL      string
}

func NewPublishHelper(state *state.State, log logging.Logger) *PublishHelper {
	return &PublishHelper{
		State: state,
		log:   log,
	}
}

func (h *PublishHelper) WriteDeploymentRecord() (*deployment.Deployment, error) {
	now := time.Now().Format(time.RFC3339)
	h.Target.DeployedAt = now
	h.Target.ConfigName = h.ConfigName
	h.Target.Configuration = h.Config

	recordPath := deployment.GetDeploymentPath(h.Dir, h.SaveName)
	localID := string(h.State.LocalID)
	return h.Target.WriteFile(recordPath, localID, h.log)
}
