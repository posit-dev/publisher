package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

// These are files that behave in a special way for Quarto
// and are not included within project inspection output,
// if exists must be included in deployment files.
var specialYmlFiles = []string{
	"_quarto.yml",
	"_quarto.yaml",
	"_metadata.yml",
	"_metadata.yaml",
	"_brand.yml",
	"_brand.yaml",
}

type QuartoDetector struct {
	inferenceHelper
	executor executor.Executor
	log      logging.Logger
}

func NewQuartoDetector(log logging.Logger) *QuartoDetector {
	return &QuartoDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        executor.NewExecutor(),
		log:             log,
	}
}

func (d *QuartoDetector) quartoInspect(path util.AbsolutePath) (*quartoInspectOutput, error) {
	args := []string{"inspect", path.String()}
	out, _, err := d.executor.RunCommand("quarto", args, util.AbsolutePath{}, d.log)
	if err != nil {
		return nil, fmt.Errorf("quarto inspect failed: %w", err)
	}
	inspectOutput, err := NewQuartoInspectOutput(out)
	if err != nil {
		return nil, err
	}
	return inspectOutput, nil
}

func (d *QuartoDetector) needsPython(inspectOutput *quartoInspectOutput) bool {
	if inspectOutput == nil {
		return false
	}
	if slices.Contains(inspectOutput.Engines, "jupyter") {
		return true
	}
	for _, script := range inspectOutput.Project.Config.Project.PreRender {
		if strings.HasSuffix(script, ".py") {
			return true
		}
	}
	for _, script := range inspectOutput.Project.Config.Project.PostRender {
		if strings.HasSuffix(script, ".py") {
			return true
		}
	}
	return false
}

func (d *QuartoDetector) needsR(inspectOutput *quartoInspectOutput) bool {
	if inspectOutput == nil {
		return false
	}
	if slices.Contains(inspectOutput.Engines, "knitr") {
		return true
	}
	for _, script := range inspectOutput.Project.Config.Project.PreRender {
		if strings.HasSuffix(script, ".R") {
			return true
		}
	}
	for _, script := range inspectOutput.Project.Config.Project.PostRender {
		if strings.HasSuffix(script, ".R") {
			return true
		}
	}
	return false
}

func (d *QuartoDetector) getTitle(inspectOutput *quartoInspectOutput, entrypointName string) string {
	isValidTitle := func(title string) bool {
		return title != "" && title != entrypointName
	}
	if isValidTitle(inspectOutput.Formats.HTML.Metadata.Title) {
		return inspectOutput.Formats.HTML.Metadata.Title
	}
	if isValidTitle(inspectOutput.Formats.RevealJS.Metadata.Title) {
		return inspectOutput.Formats.RevealJS.Metadata.Title
	}
	// Config data can exist at root level or within an additional Project object
	if isValidTitle(inspectOutput.Config.Website.Title) {
		return inspectOutput.Config.Website.Title
	}
	if isValidTitle(inspectOutput.Config.Project.Title) {
		return inspectOutput.Config.Project.Title
	}
	if isValidTitle(inspectOutput.Project.Config.Website.Title) {
		return inspectOutput.Project.Config.Website.Title
	}
	if isValidTitle(inspectOutput.Project.Config.Project.Title) {
		return inspectOutput.Project.Config.Project.Title
	}
	return ""
}

var quartoSuffixes = []string{".qmd", ".Rmd", ".ipynb", ".R", ".py", ".jl"}

func (d *QuartoDetector) findEntrypoints(base util.AbsolutePath) ([]util.AbsolutePath, error) {
	allPaths := []util.AbsolutePath{}

	for _, suffix := range quartoSuffixes {
		entrypointPaths, err := base.Glob("*" + suffix)
		if err != nil {
			return nil, err
		}
		allPaths = append(allPaths, entrypointPaths...)
	}
	return allPaths, nil
}

func isQuartoShiny(metadata *quartoMetadata) bool {
	if metadata == nil {
		return false
	}
	if metadata.Runtime == "shiny" || metadata.Server == "shiny" {
		return true
	}
	if server, ok := metadata.Server.(map[string]any); ok && server["type"] == "shiny" {
		return true
	}
	return false
}

func (d *QuartoDetector) configFromFileInspect(base util.AbsolutePath, entrypointPath util.AbsolutePath) (*config.Config, error) {
	inspectOutput, err := d.quartoInspect(entrypointPath)
	if err != nil {
		// Maybe this isn't really a quarto project, or maybe the user doesn't have quarto.
		// We log this error and continue checking the other files.
		d.log.Warn("quarto inspect failed", "file", entrypointPath.String(), "error", err)
		return nil, nil
	}

	relEntrypoint, err := entrypointPath.Rel(base)
	if err != nil {
		return nil, err
	}

	cfg := config.New()
	cfg.Entrypoint = relEntrypoint.String()
	cfg.Title = d.getTitle(inspectOutput, relEntrypoint.String())

	if isQuartoShiny(&inspectOutput.Formats.HTML.Metadata) ||
		isQuartoShiny(&inspectOutput.Formats.RevealJS.Metadata) {
		cfg.Type = contenttypes.ContentTypeQuartoShiny
	} else {
		cfg.Type = contenttypes.ContentTypeQuarto
		d.includeStaticConfig(base, cfg, inspectOutput)
	}

	var needR, needPython bool

	isDir, err := entrypointPath.IsDir()
	if err != nil {
		return nil, err
	}

	if !isDir {
		if entrypointPath.HasSuffix(".ipynb") {
			needPython = true
		} else {
			// Look for code blocks in Rmd or qmd file.
			content, err := entrypointPath.ReadFile()
			if err != nil {
				return nil, err
			}
			needR, needPython = pydeps.DetectMarkdownLanguagesInContent(content)
		}
	}

	engines := inspectOutput.Engines
	if needPython || d.needsPython(inspectOutput) {
		// Indicate that Python inspection is needed.
		cfg.Python = &config.Python{}
		if !slices.Contains(engines, "jupyter") {
			engines = append(engines, "jupyter")
		}
	}
	if needR || d.needsR(inspectOutput) {
		// Indicate that R inspection is needed.
		cfg.R = &config.R{}
		if !slices.Contains(engines, "knitr") {
			engines = append(engines, "knitr")
		}
	}
	slices.Sort(engines)

	cfg.Quarto = &config.Quarto{
		Version: inspectOutput.Quarto.Version,
		Engines: engines,
	}

	for _, inputFile := range inspectOutput.ProjectRequiredFiles() {
		var relPath string
		if filepath.IsAbs(inputFile) {
			relPath, err = filepath.Rel(base.String(), inputFile)
			if err != nil {
				return nil, err
			}
		} else {
			relPath = inputFile
		}
		cfg.Files = append(cfg.Files, fmt.Sprint("/", relPath))
	}

	for _, filename := range specialYmlFiles {
		path := base.Join(filename)
		exists, err := path.Exists()
		if err != nil {
			return nil, err
		}

		if exists {
			cfg.Files = append(cfg.Files, fmt.Sprint("/", filename))
			// Update entrypoint to keep the original _quarto.* file
			if cfg.Entrypoint == "." {
				cfg.Entrypoint = filename
			}
		}
	}
	return cfg, nil
}

// Include the static assets configuration for the Quarto project, under Config.Alternatives
// so the user has the option to deploy the static version of the project.
func (d *QuartoDetector) includeStaticConfig(base util.AbsolutePath, cfg *config.Config, inspectOutput *quartoInspectOutput) {
	entrypointRel := util.NewRelativePath(cfg.Entrypoint, nil)

	// If the entrypoint is a script, we don't generate a static configuration.
	if entrypointRel.Ext() == ".R" || entrypointRel.Ext() == ".py" {
		return
	}

	d.log.Debug("Generating Quarto static configuration", "entrypoint", cfg.Entrypoint)

	// With output-dir present, we know that any static asset will be in that directory.
	// If it is a website project, quarto inspect sets _site as the default output directory.
	if inspectOutput.OutputDir() != "" {
		staticCfg := d.staticConfigFromOutputDir(base, cfg, inspectOutput)
		if staticCfg != nil {
			cfg.Alternatives = append(cfg.Alternatives, *staticCfg)
		}
		return
	}

	d.log.Debug("Quarto project does not specify an output-dir")
	d.log.Debug("Attempting to generate Quarto document static configuration from HTML files in project")

	// Last option to generate a static configuration,
	// use inspect output files.input to generate a list with the .html ext version of the files.
	// (If there is a render list, files.input is already filtered down to the applicable files.)
	staticCfg := d.staticConfigFromFilesLookup(base, cfg, inspectOutput)
	if staticCfg != nil {
		cfg.Alternatives = append(cfg.Alternatives, *staticCfg)
	}
}

// Generate a static configuration based on the output-dir specified in the project,
// with discoverability and generation of the entrypoint HTML file related to the output-dir.
func (d *QuartoDetector) staticConfigFromOutputDir(base util.AbsolutePath, cfg *config.Config, inspectOutput *quartoInspectOutput) *config.Config {
	outputDir := inspectOutput.OutputDir()

	d.log.Debug("Quarto project has output-dir specified", "output_dir", outputDir)

	staticCfg := config.New()
	staticCfg.Type = contenttypes.ContentTypeHTML
	staticCfg.Title = cfg.Title

	// Prep the rendered version of the entrypoint path.
	outputDirRel := util.NewRelativePath(outputDir, nil)
	outputDirEntrypoint := outputDirRel.Join(cfg.Entrypoint)
	htmlVerEntrypoint := outputDirEntrypoint.WithoutExt().String() + ".html"

	entrypointIsDir, err := base.Join(cfg.Entrypoint).IsDir()
	if err != nil {
		d.log.Error("Error generating Quarto static configuration", "error", err)
		return nil
	}

	// If the entrypoint is a directory or _quarto.yml:
	// - look up for an index file
	// - OR use the static version of the first file in files.input, "outputDir + files[0] + .html"
	if d.isQuartoYaml(cfg.Entrypoint) || entrypointIsDir {
		d.log.Debug("Choosen entrypoint is _quarto.yml, attemtping to use first file from files.input as static entrypoint")

		indexFile, foundIndex := inspectOutput.IndexHTMLFilepath(base)

		if !foundIndex {
			htmlInputFiles := inspectOutput.HTMLAbsPathsFromInputList(base)
			indexFile = htmlInputFiles[0]
		}

		indexFileRel, err := indexFile.Rel(base)
		if err != nil {
			d.log.Error("Error generating Quarto static configuration", "error", err)
			return nil
		}

		// htmlVerEntrypoint = htmlInputFiles[0].String()
		htmlVerEntrypoint = outputDirRel.Join(indexFileRel.String()).String()
		d.log.Debug("Using first file from files.input as static entrypoint", "entrypoint", htmlVerEntrypoint)
	}

	staticCfg.Entrypoint = htmlVerEntrypoint
	staticCfg.Files = []string{fmt.Sprint("/", outputDir)}
	return staticCfg
}

// Generate a static configuration based on the existing project files that quarto inspect reports.
func (d *QuartoDetector) staticConfigFromFilesLookup(base util.AbsolutePath, cfg *config.Config, inspectOutput *quartoInspectOutput) *config.Config {
	staticCfg := config.New()
	staticCfg.Type = contenttypes.ContentTypeHTML
	staticCfg.Title = cfg.Title

	htmlInputFiles := inspectOutput.HTMLAbsPathsFromInputList(base)
	for _, file := range htmlInputFiles {
		relFile, err := file.Rel(base)
		if err != nil {
			d.log.Error("Error generating Quarto static configuration", "error", err)
			return nil
		}

		// If the entrypoint is not set, use the first file provided by quarto as the entrypoint.
		if staticCfg.Entrypoint == "" {
			staticCfg.Entrypoint = relFile.Base()
		}
		staticCfg.Files = append(staticCfg.Files, fmt.Sprint("/", relFile.String()))

		// Include any accompanying *_files directory for each HTML file.
		assetsDir, existsDir := inspectOutput.fileAssetsDir(file)
		if existsDir {
			relAssetsDir, err := assetsDir.Rel(base)
			if err != nil {
				d.log.Error("Error generating Quarto static configuration", "error", err)
				return nil
			}
			staticCfg.Files = append(staticCfg.Files, fmt.Sprint("/", relAssetsDir.String()))
		}
	}

	// If it wasn't possible to find any files for a static configuration,
	// we don't include alternatives.
	if len(staticCfg.Files) > 0 {
		return staticCfg
	}
	return nil
}

func (d *QuartoDetector) isQuartoYaml(entrypointBase string) bool {
	return slices.Contains([]string{"_quarto.yml", "_quarto.yaml"}, entrypointBase)
}

func (d *QuartoDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	// When the choosen entrypoint is _quarto.yml, "quarto inspect" command does not handle it well
	// but an inspection to the base directory will bring what the user expects in this case.
	if d.isQuartoYaml(entrypoint.Base()) {
		d.log.Debug("A _quarto.yml file was picked as entrypoint", "inspect_path", base.String())

		cfg, err := d.configFromFileInspect(base, base)
		if err != nil {
			return nil, err
		}

		if cfg != nil {
			return []*config.Config{cfg}, nil
		}
	}

	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		if !slices.Contains(quartoSuffixes, entrypoint.Ext()) {
			d.log.Debug("Picked entrypoint does not match Quarto file extensions, skipping", "entrypoint", entrypoint.String())
			return nil, nil
		}
	}

	var configs []*config.Config
	entrypointPaths, err := d.findEntrypoints(base)
	if err != nil {
		return nil, err
	}

	for _, entrypointPath := range entrypointPaths {
		relEntrypoint, err := entrypointPath.Rel(base)
		if err != nil {
			return nil, err
		}
		if entrypoint.String() != "" && relEntrypoint != entrypoint {
			// Only inspect the specified file
			continue
		}

		cfg, err := d.configFromFileInspect(base, entrypointPath)
		if err != nil {
			return nil, err
		}

		if cfg != nil {
			configs = append(configs, cfg)
		}
	}
	return configs, nil
}
