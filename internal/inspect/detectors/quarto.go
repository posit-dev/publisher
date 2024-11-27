package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
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

type quartoMetadata struct {
	Title   string `json:"title"`
	Runtime string `json:"runtime"`
	Server  any    `json:"server"`
}

type quartoProjectConfig struct {
	Project struct {
		Title      string   `json:"title"`
		PreRender  []string `json:"pre-render"`
		PostRender []string `json:"post-render"`
		OutputDir  string   `json:"output-dir"`
	} `json:"project"`
	Website struct {
		Title string `json:"title"`
	} `json:"website"`
}

type quartoInspectOutput struct {
	// Only the fields we use are included; the rest
	// are discarded by the JSON decoder.
	Quarto struct {
		Version string `json:"version"`
	} `json:"quarto"`
	Project struct {
		Config quartoProjectConfig `json:"config"`
		Files  struct {
			Input []string `json:"input"`
		} `json:"files"`
	} `json:"project"`
	Engines []string `json:"engines"`
	Files   struct {
		Input           []string `json:"input"`
		ConfigResources []string `json:"configResources"`
	} `json:"files"`
	// For single quarto docs without _quarto.yml
	Formats struct {
		HTML struct {
			Metadata quartoMetadata `json:"metadata"`
			Pandoc   struct {
				OutputFile string `json:"output-file"`
			} `json:"pandoc"`
		} `json:"html"`
		RevealJS struct {
			Metadata quartoMetadata `json:"metadata"`
			Pandoc   struct {
				OutputFile string `json:"output-file"`
			} `json:"pandoc"`
		} `json:"revealjs"`
	} `json:"formats"`

	// For single quarto docs without _quarto.yml,
	// there is no project section in the output.
	FileInformation map[string]struct {
		Metadata struct {
			ResourceFiles []string `json:"resource_files"`
		} `json:"metadata"`
	} `json:"fileInformation"`

	// For directory inspect (commonly due to _quarto.yml picked up as entrypoint)
	Config quartoProjectConfig `json:"config"`
}

func (d *QuartoDetector) quartoInspect(path util.AbsolutePath) (*quartoInspectOutput, error) {
	args := []string{"inspect", path.String()}
	out, _, err := d.executor.RunCommand("quarto", args, util.AbsolutePath{}, d.log)
	if err != nil {
		return nil, fmt.Errorf("quarto inspect failed: %w", err)
	}
	var inspectOutput quartoInspectOutput
	err = json.Unmarshal(out, &inspectOutput)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode quarto inspect output: %w", err)
	}
	return &inspectOutput, nil
}

func getInputFiles(inspectOutput *quartoInspectOutput) []string {
	if inspectOutput.Files.Input != nil {
		return inspectOutput.Files.Input
	}
	if inspectOutput.Project.Files.Input != nil {
		return inspectOutput.Project.Files.Input
	}
	if inspectOutput.FileInformation != nil {
		filenames := []string{}
		for name := range inspectOutput.FileInformation {
			filenames = append(filenames, name)
		}
		return filenames
	}
	return []string{}
}

func getConfigResources(inspectOutput *quartoInspectOutput) []string {
	if inspectOutput.Files.ConfigResources != nil {
		return inspectOutput.Files.ConfigResources
	}
	return []string{}
}

func uniqueFileResources(target []string, resourceFiles []string) []string {
	resourcesFound := []string{}
	for _, fileResource := range resourceFiles {
		// Prevent duplicated files
		if slices.Contains(target, fileResource) {
			continue
		}

		// Prevent special YML files here (those are handled later)
		if slices.Contains(specialYmlFiles, fileResource) {
			continue
		}

		resourcesFound = append(resourcesFound, fileResource)
	}
	return resourcesFound
}

func getFileInfoResources(inspectOutput *quartoInspectOutput) []string {
	if inspectOutput.FileInformation == nil {
		return []string{}
	}

	filesResources := []string{}
	for _, fileInfo := range inspectOutput.FileInformation {
		if fileInfo.Metadata.ResourceFiles != nil {
			filesResources = append(
				filesResources,
				uniqueFileResources(filesResources, fileInfo.Metadata.ResourceFiles)...)
		}
	}

	return filesResources
}

func getPrePostRenderFiles(inspectOutput *quartoInspectOutput) []string {
	filenames := []string{}
	preRender := inspectOutput.Config.Project.PreRender
	preRenderAlt := inspectOutput.Project.Config.Project.PreRender
	postRender := inspectOutput.Config.Project.PostRender
	postRenderAlt := inspectOutput.Project.Config.Project.PostRender
	if preRender != nil {
		filenames = append(filenames, preRender...)
	}
	if preRenderAlt != nil {
		filenames = append(filenames, preRenderAlt...)
	}
	if postRender != nil {
		filenames = append(filenames, postRender...)
	}
	if postRenderAlt != nil {
		filenames = append(filenames, postRenderAlt...)
	}
	return filenames
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
		cfg.Type = config.ContentTypeQuartoShiny
	} else {
		cfg.Type = config.ContentTypeQuarto
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

	// Include the entrypoint, its associated files and pre-post render scripts
	filesToInclude := getInputFiles(inspectOutput)
	filesToInclude = append(filesToInclude, getConfigResources(inspectOutput)...)
	filesToInclude = append(filesToInclude, getFileInfoResources(inspectOutput)...)
	filesToInclude = append(filesToInclude, getPrePostRenderFiles(inspectOutput)...)
	for _, inputFile := range filesToInclude {
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
