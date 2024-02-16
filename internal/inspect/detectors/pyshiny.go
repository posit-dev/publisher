package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
)

type pyShinyDetector struct {
	inferenceHelper
}

func NewPyShinyDetector() *pyShinyDetector {
	return &pyShinyDetector{
		inferenceHelper: defaultInferenceHelper{},
	}
}

var shinyExpressImportRE = regexp.MustCompile(`(import\s+shiny.express)|(from\s+shiny.express\s+import)|(from\s+shiny\s+import.*\bexpress\b)`)

func hasShinyExpressImport(content string) bool {
	return shinyExpressImportRE.MatchString(content)
}

func fileHasShinyExpressImport(path util.Path) (bool, error) {
	content, err := path.ReadFile()
	if err != nil {
		return false, err
	}
	return hasShinyExpressImport(string(content)), nil
}

var invalidPythonIdentifierRE = regexp.MustCompile(`(^[0-9]|[^A-Za-z0-9])`)

func shinyExpressEntrypoint(entrypoint string) string {
	module := strings.TrimSuffix(entrypoint, ".py")

	safeEntrypoint := invalidPythonIdentifierRE.ReplaceAllStringFunc(module, func(match string) string {
		return fmt.Sprintf("_%x_", int(match[0]))
	})
	return "shiny.express.app:" + safeEntrypoint + "_2e_py"
}

func (d *pyShinyDetector) InferType(path util.Path) (*config.Config, error) {
	entrypoint, entrypointPath, err := d.InferEntrypoint(path, ".py", "main.py", "app.py")
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		// We didn't find a matching filename
		return nil, nil
	}
	matches, err := d.FileHasPythonImports(entrypointPath, []string{"shiny"})
	if err != nil {
		return nil, err
	}
	if !matches {
		// Not a PyShiny app
		return nil, nil
	}
	isShinyExpress, err := fileHasShinyExpressImport(entrypointPath)
	if err != nil {
		return nil, err
	}
	cfg := config.New()

	if isShinyExpress {
		cfg.Entrypoint = shinyExpressEntrypoint(entrypoint)
	} else {
		cfg.Entrypoint = entrypoint
	}
	cfg.Type = config.ContentTypePythonShiny
	// indicate that Python inspection is needed
	cfg.Python = &config.Python{}
	return cfg, nil
}
