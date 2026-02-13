package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type RInspector interface {
	InspectR() (*config.R, error)
	RequiresR(*config.Config) (bool, error)
}

// Rpy2Checker is a function type for checking if a project has rpy2 as a dependency.
// This allows for dependency injection in tests.
type Rpy2Checker func(base util.AbsolutePath) (bool, error)

type defaultRInspector struct {
	base         util.AbsolutePath
	executor     executor.Executor
	pathLooker   util.PathLooker
	rInterpreter interpreters.RInterpreter
	log          logging.Logger
	rpy2Checker  Rpy2Checker // optional override for testing
}

var _ RInspector = &defaultRInspector{}

type RInspectorFactory func(base util.AbsolutePath, rExecutable util.Path, log logging.Logger, rInterpreterFactory interpreters.RInterpreterFactory, cmdExecutorOverride executor.Executor) (RInspector, error)

func NewRInspector(base util.AbsolutePath, rExecutable util.Path, log logging.Logger, rInterpreterFactoryOverride interpreters.RInterpreterFactory, cmdExecutorOverride executor.Executor) (RInspector, error) {

	var rInterpreter interpreters.RInterpreter
	var err error

	if rInterpreterFactoryOverride != nil {
		rInterpreter, err = rInterpreterFactoryOverride(base, rExecutable, log, cmdExecutorOverride, nil, nil)
	} else {
		// No error returned if there is no R interpreter found.
		// That can be expected when retrieving the RExecutable
		rInterpreter, err = interpreters.NewRInterpreter(base, rExecutable, log, nil, nil, nil)
	}

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
		if _, ok := types.IsAgentErrorOf(err, types.ErrorRExecNotFound); ok {
			// we have no R on the system. That's ok.
			i.log.Debug("Inspecting with no accessible R Executable.")
		} else {
			i.log.Debug("Error retrieving R Executable", "error", err)
		}
	}
	version, err := i.rInterpreter.GetRVersion()
	if err != nil {
		if _, ok := types.IsAgentErrorOf(err, types.ErrorRExecNotFound); ok {
			// we have no R on the system. That's ok.
			i.log.Debug("No R Version, since we have no accessible R Executable.")
		} else {
			i.log.Debug("Error retrieving R Version", "error", err)
		}
	}
	// GetLockFilePath will handle if there is no RVersion available. It defaults to `renv.lock`
	// and checks for the presence of it.
	packageFile, _, err := i.rInterpreter.GetLockFilePath()
	if err != nil {
		i.log.Debug("Error retrieving R package lock file", "error", err)
	}

	rProjectRequires := interpreters.NewRProjectRRequires(i.base)
	rRequires, err := rProjectRequires.GetRVersionRequirement()
	if err != nil {
		i.log.Warn("Error retrieving required R version", "error", err.Error())
		rRequires = ""
	}

	return &config.R{
		Version:          version,
		PackageFile:      packageFile.String(),
		PackageManager:   "renv",
		RequiresRVersion: rRequires,
	}, nil
}

func (i *defaultRInspector) RequiresR(cfg *config.Config) (bool, error) {
	if cfg.R != nil {
		// InferType returned an R configuration for us to fill in.
		return true, nil
	}
	if cfg.Type != contenttypes.ContentTypeHTML && !cfg.Type.IsPythonContent() {
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
	if cfg.Type.IsPythonContent() {
		// Check if the Python project uses rpy2, which requires R at runtime
		checker := pydeps.HasRpy2Dependency
		if i.rpy2Checker != nil {
			checker = i.rpy2Checker
		}
		hasRpy2, err := checker(i.base)
		if err != nil {
			return false, err
		}
		if hasRpy2 {
			i.log.Info("Detected rpy2 dependency, R is required")
			return true, nil
		}
	}
	return false, nil
}
