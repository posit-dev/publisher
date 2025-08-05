package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"time"

	"github.com/posit-dev/publisher/internal/clients/connect_cloud_upload"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type uploadBundleStartData struct{}
type uploadBundleSuccessData struct {
	BundleID types.BundleID `mapstructure:"bundleId"`
}

func (c *ServerPublisher) uploadBundle(
	bundleReader io.Reader,
	contentID types.ContentID) error {
	// Upload Bundle step
	op := events.PublishUploadBundleOp
	uploadLog := c.log.WithArgs(logging.LogKeyOp, op)

	c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, uploadBundleStartData{}))
	uploadLog.Info("Uploading files")
	// Upload bundle using the upload URL from the content response
	uploadURL := c.content.NextRevision.SourceBundleUploadURL

	uploadClient := connect_cloud_upload.NewConnectCloudUploadClient(uploadURL, c.log, 5*time.Minute)
	err := uploadClient.UploadBundle(bundleReader)
	if err != nil {
		return types.OperationError(op, fmt.Errorf("bundle upload failed: %w", err))
	}
	if err != nil {
		uploadLog.Info("Done uploading files")
		return types.OperationError(op, err)
	}

	// Update deployment record with new information
	bundleID := types.BundleID(c.content.NextRevision.SourceBundleID)
	c.Target.BundleID = bundleID
	c.Target.BundleURL = util.GetBundleURL(c.Account.URL, contentID, c.Target.BundleID)

	_, err = c.helper.WriteDeploymentRecord()
	if err != nil {
		return err
	}
	uploadLog.Info("Done uploading files", "bundle_id", bundleID)
	c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, uploadBundleSuccessData{
		BundleID: bundleID,
	}))
	return nil
}
