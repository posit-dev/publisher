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
				if f == "*" {
					scanPaths = append(scanPaths, p.Dir.String())
					continue
				}
				scanPaths = append(scanPaths, p.Dir.Join(f).String())
			}
		} else {
			// No files were selected, mimic NewBundler (project root)
			scanPaths = []string{p.Dir.String()}
		}
		// Ask the mapper to scan dependencies and return a generated lockfile
		generated, err := p.rPackageMapper.ScanDependencies(scanPaths, log)
		if err != nil {
			// If error is already an agent error, return as-is
			if aerr, isAgentErr := types.IsAgentError(err); isAgentErr {
				return nil, aerr
			}
			agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: p.Dir.String()})
			agentErr.Message = fmt.Sprintf("Could not scan R packages from project: %s", err.Error())
			return nil, agentErr
		}
        lockfilePath = generated
        lockfileString = generated.String()

        // Try to copy a lockfile into the bundle area so downstream
        // steps can reference it (and record it in the deployment).
        if rel, err := p.copyLockfileToPositDir(lockfilePath, log); err == nil {
            // Only set PackageFile when we successfully staged a lockfile.
            // This keeps semantics: empty PackageFile means no renv.
            if p.Config != nil && p.Config.R != nil {
                p.Config.R.PackageFile = rel.String()
            }
        }
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
			return nil, aerr
		}
		agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: lockfilePath.String()})
		agentErr.Message = fmt.Sprintf("Could not scan R packages from lockfile: %s, %s", lockfileString, err.Error())
		return nil, agentErr
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))

    return rPackages, nil
}

// copyLockfileToPositDir ensures a lockfile is available under .posit/publish
// for inclusion in the bundle and later record enrichment. If the provided
// lockfilePath does not exist (e.g., a mock returned a placeholder path), it
// falls back to the conventional renv.lock in the project root if present.
// Returns a relative path from the project root to the staged file.
func (p *defaultPublisher) copyLockfileToPositDir(lockfilePath util.AbsolutePath, log logging.Logger) (util.RelativePath, error) {
    targetDir := p.Dir.Join(".posit", "publish")
    if err := targetDir.MkdirAll(0777); err != nil {
        return util.RelativePath{}, err
    }

    // Choose source
    srcPath := lockfilePath
    if ok, _ := srcPath.Exists(); !ok {
        fallback := p.Dir.Join(interpreters.DefaultRenvLockfile)
        if ok2, _ := fallback.Exists(); ok2 {
            srcPath = fallback
        } else {
            return util.RelativePath{}, fmt.Errorf("no lockfile to stage: %s or project renv.lock", lockfilePath)
        }
    }

    targetPath := targetDir.Join(srcPath.Base())
    log.Debug("Staging lockfile for bundle", "source", srcPath.String(), "target", targetPath.String())

    src, err := srcPath.Open()
    if err != nil {
        return util.RelativePath{}, err
    }
    defer src.Close()

    dst, err := targetPath.Create()
    if err != nil {
        return util.RelativePath{}, err
    }
    defer dst.Close()

    if _, err = io.Copy(dst, src); err != nil {
        return util.RelativePath{}, err
    }

    rel, err := targetPath.Rel(p.Dir)
    if err != nil {
        return util.RelativePath{}, err
    }
    return rel, nil
}
