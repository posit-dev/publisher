package initialize

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/inspect/detectors"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

var ContentDetectorFactory = detectors.NewContentTypeDetector
var PythonInspectorFactory = inspect.NewPythonInspector
var RInspectorFactory = inspect.NewRInspector

func inspectProject(base util.AbsolutePath, python util.Path, rExecutable util.Path, log logging.Logger) (*config.Config, error) {
	log.Info("Detecting deployment type and entrypoint...")
	typeDetector := ContentDetectorFactory(log)

	cfg, err := typeDetector.InferType(base)
	if err != nil {
		return nil, fmt.Errorf("error detecting content type: %w", err)
	}
	log.Info("Deployment type", "Entrypoint", cfg.Entrypoint, "Type", cfg.Type)

	if cfg.Type == config.ContentTypeUnknown {
		log.Warn("Could not determine content type; creating config file with unknown type", "path", base)
	}
	if cfg.Title == "" {
		// Default title is the name of the project directory.
		cfg.Title = base.Base()
	}

	needPython, err := requiresPython(cfg, base, python)
	if err != nil {
		return nil, err
	}
	if needPython {
		inspector := PythonInspectorFactory(base, python, log)
		pyConfig, err := inspector.InspectPython()
		if err != nil {
			return nil, err
		}
		cfg.Python = pyConfig
	}
	needR, err := requiresR(cfg, base, rExecutable)
	if err != nil {
		return nil, err
	}
	if needR {
		inspector := RInspectorFactory(base, rExecutable, log)
		rConfig, err := inspector.InspectR()
		if err != nil {
			return nil, err
		}
		cfg.R = rConfig
	}

	return cfg, nil
}

func requiresPython(cfg *config.Config, base util.AbsolutePath, python util.Path) (bool, error) {
	if python.String() != "" {
		// If user provided Python on the command line,
		// then configure Python for the project.
		return true, nil
	}
	if cfg.Python != nil && cfg.Python.Version == "" {
		// InferType returned a python configuration for us to fill in.
		return true, nil
	}
	// Presence of requirements.txt implies Python is needed.
	// This is the preferred approach since it is unambiguous and
	// doesn't rely on environment inspection.
	requirementsPath := base.Join(bundles.PythonRequirementsFilename)
	exists, err := requirementsPath.Exists()
	if err != nil {
		return false, err
	}
	return exists, nil
}

func requiresR(cfg *config.Config, base util.AbsolutePath, rExecutable util.Path) (bool, error) {
	if rExecutable.String() != "" {
		// If user provided R on the command line,
		// then configure R for the project.
		return true, nil
	}
	if cfg.R != nil {
		// InferType returned an R configuration for us to fill in.
		return true, nil
	}
	if cfg.Type != config.ContentTypeHTML {
		// Presence of renv.lock implies R is needed,
		// unless we're deploying pre-rendered Rmd or Quarto
		// (where there will usually be a source file and
		// associated lockfile in the directory)
		lockfilePath := base.Join(inspect.DefaultRenvLockfile)
		exists, err := lockfilePath.Exists()
		if err != nil {
			return false, err
		}
		return exists, nil
	}
	return false, nil
}

func GetPossibleConfigs(base util.AbsolutePath, python util.Path, rExecutable util.Path, log logging.Logger) ([]*config.Config, error) {
	log.Info("Detecting deployment type and entrypoint...")
	typeDetector := ContentDetectorFactory(log)
	configs, err := typeDetector.InferAll(base)
	if err != nil {
		return nil, fmt.Errorf("error detecting content type: %w", err)
	}
	var pyConfig *config.Python

	for _, cfg := range configs {
		log.Info("Possible deployment type", "Entrypoint", cfg.Entrypoint, "Type", cfg.Type)
		if cfg.Title == "" {
			// Default title is the name of the project directory.
			cfg.Title = base.Base()
		}
		needPython, err := requiresPython(cfg, base, python)
		if err != nil {
			return nil, err
		}
		if needPython {
			if pyConfig == nil {
				inspector := PythonInspectorFactory(base, python, log)
				pyConfig, err = inspector.InspectPython()
				if err != nil {
					return nil, err
				}
			}
			cfg.Python = pyConfig
		}
		needR, err := requiresR(cfg, base, rExecutable)
		if err != nil {
			return nil, err
		}
		if needR {
			inspector := RInspectorFactory(base, rExecutable, log)
			rConfig, err := inspector.InspectR()
			if err != nil {
				return nil, err
			}
			cfg.R = rConfig
		}

	}
	return configs, nil
}

func Init(base util.AbsolutePath, configName string, python util.Path, rExecutable util.Path, log logging.Logger) (*config.Config, error) {
	if configName == "" {
		configName = config.DefaultConfigName
	}
	cfg, err := inspectProject(base, python, rExecutable, log)
	if err != nil {
		return nil, err
	}
	configPath := config.GetConfigPath(base, configName)
	err = cfg.WriteFile(configPath)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

// InitIfNeeded runs an auto-initialize if the specified config file does not exist.
func InitIfNeeded(path util.AbsolutePath, configName string, log logging.Logger) error {
	configPath := config.GetConfigPath(path, configName)
	exists, err := configPath.Exists()
	if err != nil {
		return err
	}
	if !exists {
		log.Info("Configuration file does not exist; creating it", "path", configPath.String())
		_, err = Init(path, configName, util.Path{}, util.Path{}, log)
		if err != nil {
			return err
		}
	}
	return nil
}
