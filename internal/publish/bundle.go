package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"os"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/clients/connect"
	"github.com/rstudio/connect-client/internal/events"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/types"
)

type createBundleStartData struct{}
type createBundleSuccessData struct {
	Filename string
}

type uploadBundleStartData struct{}
type uploadBundleSuccessData struct {
	BundleID types.BundleID
}

func (p *defaultPublisher) createAndUploadBundle(
	client connect.APIClient,
	bundler bundles.Bundler,
	contentID types.ContentID,
	log logging.Logger) (types.BundleID, error) {

	// Create Bundle step
	op := events.PublishCreateBundleOp
	prepareLog := log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createBundleStartData{}))
	prepareLog.Info("Preparing files")
	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return "", types.OperationError(op, err)
	}
	defer os.Remove(bundleFile.Name())
	defer bundleFile.Close()
	manifest, err := bundler.CreateBundle(bundleFile)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return "", types.OperationError(op, err)
	}
	prepareLog.Info("Done preparing files", "filename", bundleFile.Name())
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createBundleSuccessData{
		Filename: bundleFile.Name(),
	}))

	// Upload Bundle step
	op = events.PublishUploadBundleOp
	uploadLog := log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, uploadBundleStartData{}))
	uploadLog.Info("Uploading files")

	bundleID, err := client.UploadBundle(contentID, bundleFile, log)
	if err != nil {
		return "", types.OperationError(op, err)
	}

	// Update deployment record with new information
	p.Target.Files = manifest.GetFilenames()
	p.Target.BundleID = bundleID
	p.Target.BundleURL = getBundleURL(p.Account.URL, contentID, bundleID)

	err = p.writeDeploymentRecord(log)
	if err != nil {
		return "", err
	}
	uploadLog.Info("Done uploading files", "bundle_id", bundleID)
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, uploadBundleSuccessData{
		BundleID: bundleID,
	}))
	return bundleID, nil
}
