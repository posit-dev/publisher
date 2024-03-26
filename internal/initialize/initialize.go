package initialize

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/bundles/gitignore"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/inspect/detectors"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

var ContentDetectorFactory = detectors.NewContentTypeDetector
var PythonInspectorFactory = inspect.NewPythonInspector

func inspectProject(base util.AbsolutePath, python util.Path, log logging.Logger) (*config.Config, error) {
	log.Info("Detecting deployment type and entrypoint...")
	typeDetector := ContentDetectorFactory()

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

const defaultPositignoreContent = `# List any files or directories that should not be included in the deployment.
# Wildcards are supported as in .gitignore: https://git-scm.com/docs/gitignore
`

func createPositignoreIfNeeded(base util.AbsolutePath, log logging.Logger) error {
	ignorePath := base.Join(gitignore.IgnoreFilename)
	exists, err := ignorePath.Exists()
	if err != nil {
		return err
	}
	if exists {
		log.Debug(".positignore exists; not creating it")
		return nil
	}
	return ignorePath.WriteFile([]byte(defaultPositignoreContent), 0666)
}

func GetPossibleConfigs(base util.AbsolutePath, python util.Path, log logging.Logger) ([]*config.Config, error) {
	log.Info("Detecting deployment type and entrypoint...")
	typeDetector := ContentDetectorFactory()
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
	}
	return configs, nil
}

func Init(base util.AbsolutePath, configName string, python util.Path, log logging.Logger) (*config.Config, error) {
	if configName == "" {
		configName = config.DefaultConfigName
	}
	cfg, err := inspectProject(base, python, log)
	if err != nil {
		return nil, err
	}
	err = createPositignoreIfNeeded(base, log)
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
		_, err = Init(path, configName, util.Path{}, log)
		if err != nil {
			return err
		}
	}
	return nil
}
