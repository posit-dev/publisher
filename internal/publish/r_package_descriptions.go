// Copyright (C) 2024 by Posit Software, PBC.

package publish

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
)

type getRPackageDescriptionsStartData struct{}
type getRPackageDescriptionsSuccessData struct{}

type lockfileErrDetails struct {
	Lockfile string
}

func (p *defaultPublisher) getRPackages() (bundles.PackageMap, error) {
	op := events.PublishGetRPackageDescriptionsOp
	log := p.log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, getRPackageDescriptionsStartData{}))
	log.Info("Collecting R package descriptions")

	lockfileString := p.Config.R.PackageFile
	if lockfileString == "" {
		lockfileString = inspect.DefaultRenvLockfile
	}
	lockfilePath := p.Dir.Join(lockfileString)

	log.Debug("Collecting manifest R packages", "lockfile", lockfilePath)
	rPackages, err := p.rPackageMapper.GetManifestPackages(p.Dir, lockfilePath, log)
	if err != nil {
		agentErr := types.NewAgentError(types.ErrorRenvLockPackagesReading, err, lockfileErrDetails{Lockfile: lockfilePath.String()})
		agentErr.Message = fmt.Sprintf("Could not scan R packages from lockfile: %s", lockfileString)
		return nil, agentErr
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))
	return rPackages, nil
}
