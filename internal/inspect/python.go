package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
)

type PythonInspector interface {
	InspectPython() (*config.Python, error)
	RequiresPython(*config.Config) (bool, error)
	ScanRequirements(base util.AbsolutePath) ([]string, []string, string, error)
	GetPythonInterpreter() interpreters.PythonInterpreter
}

// ReticulateChecker is a function type for checking if a project has reticulate as a dependency.
// This allows for dependency injection in tests.
type ReticulateChecker func(base util.AbsolutePath) (bool, error)

type defaultPythonInspector struct {
	base              util.AbsolutePath
	executor          executor.Executor
	pathLooker        util.PathLooker
	scanner           pydeps.DependencyScanner
	pythonInterpreter interpreters.PythonInterpreter
	log               logging.Logger
	reticulateChecker ReticulateChecker // optional override for testing
}

var _ PythonInspector = &defaultPythonInspector{}

type PythonInspectorFactory func(base util.AbsolutePath, pythonPath util.Path, log logging.Logger, pythonInterpreterFactoryOverride interpreters.PythonInterpreterFactory, cmdExecutorOverride executor.Executor) (PythonInspector, error)

func NewPythonInspector(base util.AbsolutePath, pythonExecutable util.Path, log logging.Logger, pythonInterpreterFactoryOverride interpreters.PythonInterpreterFactory, cmdExecutorOverride executor.Executor) (PythonInspector, error) {

	var pythonInterpreter interpreters.PythonInterpreter
	var err error

	if pythonInterpreterFactoryOverride != nil {
		pythonInterpreter, err = pythonInterpreterFactoryOverride(base, pythonExecutable, log, cmdExecutorOverride, nil, nil)
	} else {
		// No error returned if there is no R interpreter found.
		// That can be expected when retrieving the RExecutable
		pythonInterpreter, err = interpreters.NewPythonInterpreter(base, pythonExecutable, log, nil, nil, nil)
	}

	return &defaultPythonInspector{
		executor:          executor.NewExecutor(),
		pathLooker:        util.NewPathLooker(),
		scanner:           pydeps.NewDependencyScanner(log),
		base:              base,
		pythonInterpreter: pythonInterpreter,
		log:               log,
	}, err
}

func (i *defaultPythonInspector) GetPythonInterpreter() interpreters.PythonInterpreter {
	return i.pythonInterpreter
}

// InspectPython inspects the specified project directory,
// returning a Python configuration.
// If requirements.txt does not exist, it will be created.
// The python version (and packages if needed) will
// be determined by the specified pythonExecutable,
// or by `python3` or `python` on $PATH.
func (i *defaultPythonInspector) InspectPython() (*config.Python, error) {
	_, err := i.pythonInterpreter.GetPythonExecutable()
	if err != nil {
		if _, ok := types.IsAgentErrorOf(err, types.ErrorPythonExecNotFound); ok {
			// we have no Python on the system. That's ok.
			i.log.Debug("Inspecting with no accessible Python Executable.", "error", err)
		} else {
			i.log.Debug("Error retrieving Python Executable", "error", err)
		}
		return nil, err
	}
	version, err := i.pythonInterpreter.GetPythonVersion()
	if err != nil {
		if _, ok := types.IsAgentErrorOf(err, types.ErrorRExecNotFound); ok {
			// we have no Python on the system. That's ok.
			i.log.Debug("No Python Version, since we have no accessible Python Executable.", "error", err)
		} else {
			i.log.Debug("Error retrieving Python Version", "error", err)
		}
		return nil, err
	}

	reqFile, exists, err := pydeps.DoesDefaultRequirementsExist(i.base)
	if err != nil {
		return nil, err
	}
	if exists {
		i.log.Info("Using Python packages", "source", reqFile.String())
	} else {
		i.log.Warn("can't find requirements.txt")
	}

	pyProjectRequires := interpreters.NewPyProjectPythonRequires(i.base)
	python_requires, err := pyProjectRequires.GetPythonVersionRequirement()
	if err != nil {
		i.log.Warn("Error retrieving Python requires", err)
		python_requires = ""
	}

	return &config.Python{
		Version:               version,
		PackageFile:           reqFile.String(),
		PackageManager:        i.pythonInterpreter.GetPackageManager(),
		RequiresPythonVersion: python_requires,
	}, nil
}

func (i *defaultPythonInspector) ScanRequirements(base util.AbsolutePath) ([]string, []string, string, error) {
	oldWD, err := util.Chdir(base.String())
	if err != nil {
		return nil, nil, "", err
	}
	defer util.Chdir(oldWD)

	pythonExecutable, err := i.pythonInterpreter.GetPythonExecutable()
	if err != nil {
		return nil, nil, "", err
	}
	specs, err := i.scanner.ScanDependencies(base, pythonExecutable.String())
	if err != nil {
		return nil, nil, "", err
	}
	reqs := make([]string, 0, len(specs))
	incomplete := []string{}

	for _, spec := range specs {
		reqs = append(reqs, spec.String())
		if spec.Version == "" {
			incomplete = append(incomplete, string(spec.Name))
		}
	}
	return reqs, incomplete, pythonExecutable.String(), nil
}

func (i *defaultPythonInspector) RequiresPython(cfg *config.Config) (bool, error) {
	if cfg.Python != nil && cfg.Python.Version == "" {
		// InferType returned a python configuration for us to fill in.
		return true, nil
	}
	// Presence of requirements.txt implies Python is needed.
	// This is the preferred approach since it is unambiguous and
	// doesn't rely on environment inspection.
	_, exists, err := pydeps.DoesDefaultRequirementsExist(i.base)
	if err != nil {
		return false, err
	}
	if exists {
		return true, nil
	}
	// Check if the R project uses reticulate, which requires Python at runtime
	if cfg.Type.IsRContent() {
		checker := renv.HasReticulateDependency
		if i.reticulateChecker != nil {
			checker = i.reticulateChecker
		}
		hasReticulate, err := checker(i.base)
		if err != nil {
			return false, err
		}
		if hasReticulate {
			i.log.Info("Detected reticulate dependency, Python is required")
			return true, nil
		}
	}
	return false, nil
}
