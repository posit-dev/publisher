package publish

import (
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect"
	"github.com/posit-dev/publisher/internal/logging"
)

type getRPackageDescriptionsStartData struct{}
type getRPackageDescriptionsSuccessData struct{}

func (p *defaultPublisher) getRPackages(log logging.Logger) (bundles.PackageMap, error) {
	op := events.PublishGetRPackageDescriptionsOp
	log = log.WithArgs(logging.LogKeyOp, op)

	p.emitter.Emit(events.New(op, events.StartPhase, events.NoError, getRPackageDescriptionsStartData{}))
	log.Info("Collecting R package descriptions")

	lockfileString := p.Config.R.PackageFile
	if lockfileString == "" {
		lockfileString = inspect.DefaultRenvLockfile
	}
	lockfilePath := p.Dir.Join(lockfileString)

	rPackages, err := p.rPackageMapper.GetManifestPackages(p.Dir, lockfilePath, log)
	if err != nil {
		return nil, err
	}
	log.Info("Done collecting R package descriptions")
	p.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, getRPackageDescriptionsSuccessData{}))
	return rPackages, nil
}
