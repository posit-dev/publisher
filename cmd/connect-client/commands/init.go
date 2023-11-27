package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/environment"
	"github.com/rstudio/connect-client/internal/inspect"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

func (cmd *InitCommand) inspectProjectType(log logging.Logger) (*inspect.ContentType, error) {
	log.Info("Detecting deployment type and entrypoint...")
	typeDetector := inspect.NewContentTypeDetector()
	contentType, err := typeDetector.InferType(cmd.Path)
	if err != nil {
		return nil, fmt.Errorf("error detecting content type: %w", err)
	}
	log.Info("Deployment type", "Entrypoint", contentType.Entrypoint, "AppMode", contentType.AppMode)
	return contentType, nil
}

type InitCommand struct {
	Path       util.Path `help:"Path to directory containing files to publish." arg:"" default:"."`
	Python     util.Path `help:"Path to Python interpreter for this content, if it is Python-based. Default is the Python 3 on your PATH."`
	ConfigName string    `name:"config" short:"c" help:"Configuration name to create (in .posit/publish/)"`
	config     *config.Config
}

func (cmd *InitCommand) requiresPython(appMode apptypes.AppMode) (bool, error) {
	if appMode.IsPythonContent() {
		return true, nil
	}
	if cmd.Python.Path() != "" {
		return true, nil
	}
	// Presence of requirements.txt implies Python is needed.
	// This is the preferred approach since it is unambiguous and
	// doesn't rely on environment inspection.
	requirementsPath := cmd.Path.Join(bundles.PythonRequirementsFilename)
	exists, err := requirementsPath.Exists()
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (cmd *InitCommand) inspectPython(log logging.Logger) (*config.Python, error) {
	cfg := &config.Python{}
	inspector := environment.NewPythonInspector(cmd.Path, cmd.Python, log)
	version, err := inspector.GetPythonVersion()
	if err != nil {
		return nil, err
	}
	cfg.Version = version

	err = inspector.EnsurePythonRequirementsFile()
	if err != nil {
		return nil, err
	}
	// Package list will be written to requirements.txt, if not already present.
	cfg.PackageManager = "pip"
	cfg.PackageFile = bundles.PythonRequirementsFilename
	return cfg, nil
}

func (cmd *InitCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	if cmd.ConfigName == "" {
		cmd.ConfigName = config.DefaultConfigName
	}
	cmd.config = config.New()
	contentType, err := cmd.inspectProjectType(ctx.Logger)
	if err != nil {
		return err
	}
	cmd.config.Type = contentType.AppMode
	cmd.config.Entrypoint = contentType.Entrypoint

	requiresPython, err := cmd.requiresPython(contentType.AppMode)
	if err != nil {
		return err
	}
	if requiresPython {
		pythonConfig, err := cmd.inspectPython(ctx.Logger)
		if err != nil {
			return err
		}
		cmd.config.Python = pythonConfig
	}
	configPath := config.GetConfigPath(cmd.Path, cmd.ConfigName)
	err = cmd.config.WriteFile(configPath)
	ctx.Logger.Info("Wrote config file", "path", configPath)

	if err != nil {
		return err
	}
	return nil
}
