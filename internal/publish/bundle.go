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

	filesPatterns := make([]string, len(p.Config.Files))
	copy(filesPatterns, p.Config.Files)

	// If user didn't specify file patterns, start from wildcard before adding
	// dependency-source related inclusions/exclusions so we don't end up with
	// only the staged lockfile patterns and accidentally exclude application files.
	if len(filesPatterns) == 0 {
		filesPatterns = append(filesPatterns, "*")
	}

	// If a dependency source (e.g., renv.lock) was used to build the manifest,
	// stage it under .posit/publish to ensure it is included in the bundle.
	if manifest != nil && manifest.DependenciesSource.String() != "" {
		src := manifest.DependenciesSource
		// If the source is not the project root renv.lock, stage a copy and
		// prefer the staged copy by excluding root renv.lock from walking.
		if src.String() != p.Dir.Join("renv.lock").String() {
			if ok, _ := src.Exists(); ok {
				if _, err := p.copyLockfileToPositDir(src, p.log); err != nil {
					return nil, types.OperationError(op, err)
				}
			}
			filesPatterns = append(filesPatterns, "!renv.lock", ".posit/publish/renv.lock")
		}
	}

	err := p.addDependenciesToTarget(manifest)
	if err != nil {
		return nil, err
	}

	// Create Bundle step
	bundler, err := bundles.NewBundler(p.Dir, manifest, filesPatterns, p.log)
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

	// Update deployment record with files actually included in manifest
	p.Target.Files = manifest.GetFilenames()

	return bundleFile, nil
}
