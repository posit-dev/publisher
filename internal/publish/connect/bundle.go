package connect

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"io"
)

type uploadBundleStartData struct{}
type uploadBundleSuccessData struct {
	BundleID types.BundleID `mapstructure:"bundleId"`
}

func (c *ServerPublisher) uploadBundle(
	bundleReader io.Reader,
	contentID types.ContentID) (types.BundleID, error) {
	// Upload Bundle step
	op := events.PublishUploadBundleOp
	uploadLog := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, uploadBundleStartData{}))
	uploadLog.Info("Uploading files")

	bundleID, err := c.client.UploadBundle(contentID, bundleReader, c.log)
	c.log.Debug("Bundle uploaded", "deployment", c.TargetName, "bundle_id", bundleID)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	// Update deployment record with new information
	c.Target.BundleID = bundleID
	c.Target.BundleURL = util.GetBundleURL(c.Account.URL, contentID, bundleID)

	_, err = c.helper.WriteDeploymentRecord()
	if err != nil {
		return "", err
	}
	uploadLog.Info("Done uploading files", "bundle_id", bundleID)
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, uploadBundleSuccessData{
		BundleID: bundleID,
	}))
	return bundleID, nil
}
