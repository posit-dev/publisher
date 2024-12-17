package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type RInspector interface {
	InspectR() (*config.R, error)
	RequiresR(*config.Config) (bool, error)
}

type defaultRInspector struct {
	base         util.AbsolutePath
	executor     executor.Executor
	pathLooker   util.PathLooker
	rInterpreter interpreters.RInterpreter
	log          logging.Logger
}

var _ RInspector = &defaultRInspector{}

func NewRInspector(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) (RInspector, error) {

	rInterpreter := interpreters.NewRInterpreter(base, rExecutable, log)
	err := rInterpreter.Init()

	return &defaultRInspector{
		base:         base,
		executor:     executor.NewExecutor(),
		pathLooker:   util.NewPathLooker(),
		rInterpreter: rInterpreter,
		log:          log,
	}, err
}

// InspectR inspects the specified project directory,
// returning an R configuration.
func (i *defaultRInspector) InspectR() (*config.R, error) {
	_, err := i.rInterpreter.GetRExecutable()
	if err != nil {
		i.log.Debug("Error retrieving R Executable", "error", err)
	}
	version, err := i.rInterpreter.GetRVersion()
	if err != nil {
		i.log.Debug("Error retrieving R Version", "error", err)
	}
	packageFile, _, err := i.rInterpreter.GetLockFilePath()
	if err != nil {
		i.log.Debug("Error retrieving R package lock file", "error", err)
	}

	return &config.R{
		Version:        version,
		PackageFile:    packageFile.String(),
		PackageManager: "renv",
	}, nil
}

func (i *defaultRInspector) RequiresR(cfg *config.Config) (bool, error) {
	if cfg.R != nil {
		// InferType returned an R configuration for us to fill in.
		return true, nil
	}
	if cfg.Type != config.ContentTypeHTML && !cfg.Type.IsPythonContent() {
		// Presence of renv.lock implies R is needed,
		// unless we're deploying pre-rendered Rmd or Quarto
		// (where there will usually be a source file and
		// associated lockfile in the directory)
		_, exists, err := i.rInterpreter.GetLockFilePath()
		if err != nil {
			return false, err
		}
		return exists, nil
	}
	return false, nil
}
