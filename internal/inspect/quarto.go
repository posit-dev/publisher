package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"
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

func (d *QuartoDetector) hasQuartoFile(path util.Path) (bool, error) {
	files, err := path.Glob("*.qmd")
	if err != nil {
		return false, err
	}
	if len(files) > 0 {
		return true, nil
	}
	return false, nil
}

func (d *QuartoDetector) InferType(base util.Path) (*config.Config, error) {
	haveQuartoFile, err := d.hasQuartoFile(base)
	if err != nil {
		return nil, err
	}
	if !haveQuartoFile {
		return nil, nil
	}
	inspectOutput, err := d.quartoInspect(base)
	if err != nil {
		return nil, err
	}
	if slices.Contains(inspectOutput.Engines, "knitr") {
		return nil, errNoQuartoKnitrSupport
	}
	if len(inspectOutput.Files.Input) == 0 {
		return nil, nil
	}
	cfg := config.New()
	cfg.Type = config.ContentTypeQuarto
	cfg.Entrypoint = path.Base(inspectOutput.Files.Input[0])

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
