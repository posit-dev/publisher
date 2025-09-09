// Copyright (C) 2024 by Posit Software, PBC.

package publish

import (
	"fmt"
	"io"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type getRPackageDescriptionsStartData struct{}
type getRPackageDescriptionsSuccessData struct{}

type lockfileErrDetails struct {
	Lockfile string
}

func (p *defaultPublisher) getRPackages(scanDependencies bool) (bundles.PackageMap, error) {
	pkgs, _, err := p.getRPackagesWithPath(scanDependencies)
	return pkgs, err
}

// getRPackagesWithPath returns packages and the absolute lockfile path used.
func (p *defaultPublisher) getRPackagesWithPath(scanDependencies bool) (bundles.PackageMap, util.AbsolutePath, error) {
	op := events.PublishGetRPackageDescriptionsOp
	log := p.log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, getRPackageDescriptionsStartData{}))
	log.Info("Collecting R package descriptions")

	var lockfilePath util.AbsolutePath
	var lockfileString string
	if scanDependencies {
		log.Info("Detect dependencies from project")
		var scanPaths []string
		if p.Config != nil && len(p.Config.Files) > 0 {
			scanPaths = make([]string, 0, len(p.Config.Files))
			for _, f := range p.Config.Files {
				scanPaths = append(scanPaths, p.Dir.Join(f).String())
			}
		} else {
			// No files were selected, in this case we mimic NewBundler
			// which implies the project directory itself.
			scanPaths = []string{p.Dir.String()}
		}
		// Ask the mapper to scan dependencies and return a generated lockfile
		generated, err := p.rPackageMapper.ScanDependencies(scanPaths, log)
		if err != nil {
			// If error is already an agent error, return as-is
			if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
				return nil, util.AbsolutePath{}, aerr
			}
			agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: p.Dir.String()})
			agentErr.Message = fmt.Sprintf("Could not scan R packages from project: %s", err.Error())
			return nil, util.AbsolutePath{}, agentErr
		}
		lockfilePath = generated
		lockfileString = generated.String()
	} else {
		lockfileString = p.Config.R.PackageFile
		if lockfileString == "" {
			lockfileString = interpreters.DefaultRenvLockfile
		}
		lockfilePath = p.Dir.Join(lockfileString)
	}

	// Detect mapper type to decide which message to emit
	if _, isLock := p.rPackageMapper.(*renv.LockfilePackageMapper); isLock {
		log.Info("Loading packages from renv.lock", "lockfile", lockfilePath.String())
	} else {
		log.Info("Loading packages from local R library")
	}
	log.Debug("Collecting manifest R packages", "lockfile", lockfilePath)

	rPackages, err := p.rPackageMapper.GetManifestPackages(p.Dir, lockfilePath, log)
	if err != nil {
		// If error is an already well detailed agent error, pass it along
		if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
			return nil, util.AbsolutePath{}, aerr
		}
		agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: lockfilePath.String()})
		agentErr.Message = fmt.Sprintf("Could not scan R packages from lockfile: %s, %s", lockfileString, err.Error())
		return nil, util.AbsolutePath{}, agentErr
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))

	return rPackages, lockfilePath, nil
}

// copyLockfileToPositDir copies a lockfile into .posit/publish within the
// project directory. Returns the path relative to the project root.
func (p *defaultPublisher) copyLockfileToPositDir(lockfilePath util.Path, log logging.Logger) (util.RelativePath, error) {
	// Ensure destination directory exists
	targetDir := p.Dir.Join(".posit", "publish")
	if err := targetDir.MkdirAll(0777); err != nil {
		return util.RelativePath{}, err
	}

	src, err := lockfilePath.Open()
	if err != nil {
		return util.RelativePath{}, err
	}
	defer src.Close()

	// Always stage as renv.lock regardless of source filename
	targetPath := targetDir.Join("renv.lock")
	dst, err := targetPath.Create()
	if err != nil {
		return util.RelativePath{}, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return util.RelativePath{}, err
	}

	rel, err := targetPath.Rel(p.Dir)
	if err != nil {
		return util.RelativePath{}, err
	}
	return rel, nil
}
