package inspect

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/util"
)

type NotebookDetector struct {
	inferenceHelper
}

func NewNotebookDetector() *NotebookDetector {
	return &NotebookDetector{
		defaultInferenceHelper{},
	}
}

var voilaImportNames = []string{
	"ipywidgets",
	// From the Voila example notebooks
	"bqplot",
	"ipympl",
	"ipyvolume",
	// Other widget packages from PyPI
	"ipyspeck",
	"ipywebgl",
	"ipywebrtc",
}

func (d *NotebookDetector) InferType(path util.Path) (*ContentType, error) {
	entrypoint, entrypointPath, err := d.InferEntrypoint(path, ".ipynb", "index.ipynb")
	if err != nil {
		return nil, err
	}
	if entrypoint != "" {
		code, err := getNotebookFileInputs(entrypointPath)
		if err != nil {
			return nil, err
		}
		isVoila, err := d.HasPythonImports(strings.NewReader(code), voilaImportNames)
		if err != nil {
			return nil, err
		}
		t := &ContentType{
			Entrypoint:     entrypoint,
			RequiresPython: true,
		}
		if isVoila {
			t.AppMode = apptypes.JupyterVoilaMode
		} else {
			t.AppMode = apptypes.StaticJupyterMode
		}
		return t, nil
	}
	return nil, nil
}

func getNotebookFileInputs(path util.Path) (string, error) {
	f, err := path.Open()
	if err != nil {
		return "", err
	}
	defer f.Close()
	return getNotebookInputs(f)
}

func getNotebookInputs(r io.Reader) (string, error) {
	decoder := json.NewDecoder(r)

	type jsonObject = map[string]any
	var notebookContents jsonObject
	err := decoder.Decode(&notebookContents)
	if err != nil {
		return "", err
	}
	cells, ok := notebookContents["cells"].([]any)
	if !ok || len(cells) == 0 {
		return "", nil
	}
	combinedSource := []string{}
	for cellNum, rawCell := range cells {
		cell, ok := rawCell.(jsonObject)
		if !ok {
			return "", fmt.Errorf("notebook cell %d is not an object", cellNum)
		}
		cellType, ok := cell["cell_type"].(string)
		if !ok {
			return "", fmt.Errorf("notebook cell %d is missing cell_type", cellNum)
		}
		if cellType == "code" {
			sourceLines, ok := cell["source"].([]any)
			if !ok {
				return "", fmt.Errorf("notebook cell %d has an invalid source", cellNum)
			}
			for lineNum, rawLine := range sourceLines {
				line, ok := rawLine.(string)
				if !ok {
					return "", fmt.Errorf("notebook cell %d line %d is not a string", cellNum, lineNum)
				}
				combinedSource = append(combinedSource, line)
			}
		}
	}
	return strings.Join(combinedSource, ""), nil
}
