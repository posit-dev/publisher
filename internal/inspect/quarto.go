package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/util"
)

type QuartoDetector struct {
	inferenceHelper
	executor util.Executor
}

func NewQuartoDetector() *QuartoDetector {
	return &QuartoDetector{
		inferenceHelper: defaultInferenceHelper{},
		executor:        util.NewExecutor(),
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
			Title      string `json:"title"`
			PreRender  string `json:"pre-render"`
			PostRender string `json:"post-render"`
		} `json:"project"`
	} `json:"config"`
	Engines []string `json:"engines"`
}

func (d *QuartoDetector) quartoInspect(path util.Path) (*quartoInspectOutput, error) {
	args := []string{"inspect", path.String()}
	out, err := d.executor.RunCommand("quarto", args)
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
	return slices.Contains(inspectOutput.Engines, "jupyter") ||
		strings.HasSuffix(inspectOutput.Config.Project.PreRender, ".py") ||
		strings.HasSuffix(inspectOutput.Config.Project.PostRender, ".py")
}

func (d *QuartoDetector) InferType(path util.Path) (*config.Config, error) {
	// Quarto default file is based on the project directory name
	defaultEntrypoint := path.Base() + ".qmd"
	entrypoint, _, err := d.InferEntrypoint(path, ".qmd", defaultEntrypoint)
	if err != nil {
		return nil, err
	}
	if entrypoint == "" {
		return nil, nil
	}
	inspectOutput, err := d.quartoInspect(path)
	if err != nil {
		return nil, err
	}
	if slices.Contains(inspectOutput.Engines, "knitr") {
		return nil, errNoQuartoKnitrSupport
	}
	cfg := config.New()
	cfg.Type = config.ContentTypeQuarto
	cfg.Entrypoint = entrypoint
	cfg.Title = inspectOutput.Config.Project.Title

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
