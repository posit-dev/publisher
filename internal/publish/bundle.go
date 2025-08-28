package publish

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"os"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

func (p *defaultPublisher) createBundle(manifest *bundles.Manifest) (*os.File, error) {
	op := events.PublishCreateBundleOp
	prepareLog := p.log.WithArgs(logging.LogKeyOp, op)
	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, createBundleStartData{}))
	prepareLog.Info("Preparing files")

	err := p.readInterpreterDetails()
	if err != nil {
		return nil, err
	}

	// Create Bundle step
	bundler, err := bundles.NewBundler(p.Dir, manifest, p.Config.Files, p.log)
	if err != nil {
		return nil, err
	}

	bundleFile, err := os.CreateTemp("", "bundle-*.tar.gz")
	if err != nil {
		return nil, types.OperationError(op, err)
	}
	manifest, err = bundler.CreateBundle(bundleFile)
	if err != nil {
		return nil, types.OperationError(op, err)
	}

	_, err = bundleFile.Seek(0, io.SeekStart)
	if err != nil {
		return nil, types.OperationError(op, err)
	}
	prepareLog.Info("Done preparing files", "filename", bundleFile.Name())
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, createBundleSuccessData{
		Filename: bundleFile.Name(),
	}))

	// Update deployment record with new information
	p.Target.Files = manifest.GetFilenames()

	return bundleFile, nil
}
