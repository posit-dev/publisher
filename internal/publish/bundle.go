package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"os"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type createBundleStartData struct{}
type createBundleSuccessData struct {
	Filename string `mapstructure:"filename"`
}

type uploadBundleStartData struct{}
type uploadBundleSuccessData struct {
	BundleID types.BundleID `mapstructure:"bundleId"`
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

	if p.Config.Python != nil {
		filename := p.Config.Python.PackageFile
		if filename == "" {
			filename = inspect.PythonRequirementsFilename
		}
		inspector := inspect.NewPythonInspector(p.Dir, util.Path{}, log)
		requirements, err := inspector.ReadRequirementsFile(p.Dir.Join(filename))
		if err != nil {
			return "", err
		}
		p.Target.Requirements = requirements
	}

	if p.Config.R != nil {
		filename := p.Config.R.PackageFile
		if filename == "" {
			filename = inspect.DefaultRenvLockfile
		}
		lockfile, err := renv.ReadLockfile(p.Dir.Join(filename))
		if err != nil {
			return "", err
		}
		p.Target.Renv = lockfile
	}

	err = p.writeDeploymentRecord()
	if err != nil {
		return "", err
	}
	uploadLog.Info("Done uploading files", "bundle_id", bundleID)
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, uploadBundleSuccessData{
		BundleID: bundleID,
	}))
	return bundleID, nil
}
