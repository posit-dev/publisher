// Copyright (C) 2024 by Posit Software, PBC.

package publish

import (
	"errors"
	"fmt"
	"os"

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

const lockfileMissing = `Missing R lockfile %s. 
The file must exist and be included in the deployment.
Create the file listing your project dependencies.
Or do an automatic scan with the help of the R Packages section
of the Publisher extension and review the generated file`

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
		if errors.Is(err, os.ErrNotExist) {
			agentErr.Message = fmt.Sprintf(lockfileMissing, lockfileString)
		}
		return nil, agentErr
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))
	return rPackages, nil
}
