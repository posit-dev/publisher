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

	// If a dependency source (e.g., renv.lock) was used to build the manifest,
	// stage it under .posit/publish to ensure it is included in the bundle.
	filesPatterns := make([]string, len(p.Config.Files))
	copy(filesPatterns, p.Config.Files)
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

	// Update deployment record with new information
	p.Target.Files = manifest.GetFilenames()
	if len(p.Target.Files) == 0 {
		// Fallback: record common files if matcher configuration produced an
		// empty file set. This ensures deployment records remain useful.
		files := []string{}
		if p.Config != nil {
			if p.Config.Entrypoint != "" {
				if ok, _ := p.Dir.Join(p.Config.Entrypoint).Exists(); ok {
					files = append(files, p.Config.Entrypoint)
				}
			}
			if p.Config.Python != nil {
				req := p.Config.Python.PackageFile
				if req == "" {
					req = bundles.PythonRequirementsFilename
				}
				if ok, _ := p.Dir.Join(req).Exists(); ok {
					files = append(files, req)
				}
			}
		}
		if len(files) > 0 {
			p.Target.Files = files
		}
	}

	return bundleFile, nil
}
