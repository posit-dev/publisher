package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
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

var errNoQuartoKnitrSupport = errors.New("quarto with knitr engine is not yet supported")

type quartoInspectOutput struct {
	// Only the fields we use are included; the rest
	// are discarded by the JSON decoder.
	Quarto struct {
		Version string `json:"version"`
	} `json:"quarto"`
	Config struct {
		Project struct {
			Title      string   `json:"title"`
			PreRender  []string `json:"pre-render"`
			PostRender []string `json:"post-render"`
		} `json:"project"`
		Website struct {
			Title string `json:"title"`
		} `json:"website"`
	} `json:"config"`
	Engines []string `json:"engines"`
	Files   struct {
		Input []string `json:"input"`
	} `json:"files"`
}

func (d *QuartoDetector) quartoInspect(path util.Path) (*quartoInspectOutput, error) {
	args := []string{"inspect", path.String()}
	out, err := d.executor.RunCommand("quarto", args, d.log)
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
	if slices.Contains(inspectOutput.Engines, "jupyter") {
		return true
	}
	for _, script := range inspectOutput.Config.Project.PreRender {
		if strings.HasSuffix(script, ".py") {
			return true
		}
	}
	for _, script := range inspectOutput.Config.Project.PostRender {
		if strings.HasSuffix(script, ".py") {
			return true
		}
	}
	return false
}

func (d *QuartoDetector) InferType(base util.Path) (*config.Config, error) {
	defaultEntrypoint := base.Base() + ".qmd"
	entrypoint, _, err := d.InferEntrypoint(base, ".qmd", defaultEntrypoint, "index.qmd")
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		return nil, nil
	}
	inspectOutput, err := d.quartoInspect(base)
	if err != nil {
		// Maybe this isn't really a quarto project, or maybe the user doesn't have quarto.
		// We log this error and return nil so other inspectors can have a shot at it.
		d.log.Warn("quarto inspect failed", "error", err)
		return nil, nil
	}
	if slices.Contains(inspectOutput.Engines, "knitr") {
		return nil, errNoQuartoKnitrSupport
	}
	if len(inspectOutput.Files.Input) == 0 {
		return nil, nil
	}
	cfg := config.New()
	cfg.Type = config.ContentTypeQuarto
	cfg.Entrypoint = entrypoint

	cfg.Title = inspectOutput.Config.Website.Title
	if cfg.Title == "" {
		cfg.Title = inspectOutput.Config.Project.Title
	}

	cfg.Quarto = &config.Quarto{
		Version: inspectOutput.Quarto.Version,
		Engines: inspectOutput.Engines,
	}
	if d.needsPython(inspectOutput) {
		// Indicate that Python inspection is needed.
		cfg.Python = &config.Python{}
	}
	return cfg, nil
}
