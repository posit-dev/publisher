package detectors

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type QuartoDetector struct {
	inferenceHelper
	executor executor.Executor
	log      logging.Logger
}

func NewQuartoDetector() *QuartoDetector {
	return &QuartoDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        executor.NewExecutor(),
		log:             logging.New(),
	}
}

type quartoMetadata struct {
	Title   string `json:"title"`
	Runtime string `json:"runtime"`
	Server  any    `json:"server"`
}

type quartoInspectOutput struct {
	// Only the fields we use are included; the rest
	// are discarded by the JSON decoder.
	Quarto struct {
		Version string `json:"version"`
	} `json:"quarto"`
	Project struct {
		Config struct {
			Project struct {
				Title      string   `json:"title"`
				PreRender  []string `json:"pre-render"`
				PostRender []string `json:"post-render"`
				OutputDir  string   `json:"output-dir"`
			} `json:"project"`
			Website struct {
				Title string `json:"title"`
			} `json:"website"`
		} `json:"config"`
	} `json:"project"`
	Engines []string `json:"engines"`
	Files   struct {
		Input []string `json:"input"`
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
	if isValidTitle(inspectOutput.Project.Config.Website.Title) {
		return inspectOutput.Project.Config.Website.Title
	}
	if isValidTitle(inspectOutput.Project.Config.Project.Title) {
		return inspectOutput.Project.Config.Project.Title
	}
	return ""
}

var quartoSuffixes = []string{".qmd", ".Rmd", ".ipynb"}

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

func (d *QuartoDetector) InferType(base util.AbsolutePath, entrypoint util.RelativePath) ([]*config.Config, error) {
	if entrypoint.String() != "" {
		// Optimization: skip inspection if there's a specified entrypoint
		// and it's not one of ours.
		suffix := entrypoint.Ext()
		if suffix != ".qmd" && suffix != ".Rmd" && suffix != ".ipynb" {
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
		inspectOutput, err := d.quartoInspect(entrypointPath)
		if err != nil {
			// Maybe this isn't really a quarto project, or maybe the user doesn't have quarto.
			// We log this error and continue checking the other files.
			d.log.Warn("quarto inspect failed", "file", entrypointPath.String(), "error", err)
			continue
		}
		if inspectOutput.Files.Input != nil && len(inspectOutput.Files.Input) == 0 {
			continue
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

		// Exclude locally-rendered artifacts, since this will be rendered in Connect
		outputFile := inspectOutput.Formats.HTML.Pandoc.OutputFile
		if outputFile == "" {
			outputFile = inspectOutput.Formats.RevealJS.Pandoc.OutputFile
			if outputFile == "" {
				outputFile = "*.html"
			}
		}
		htmlOutputDir := strings.TrimSuffix(outputFile, ".html") + "_files"

		cfg.Files = append(cfg.Files, "!"+outputFile, "!"+htmlOutputDir)
		projectOutputDir := inspectOutput.Project.Config.Project.OutputDir
		if projectOutputDir != "" {
			cfg.Files = append(cfg.Files, "!"+projectOutputDir)
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}
