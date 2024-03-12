package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/rstudio/connect-client/internal/util"
)

func GetNotebookFileInputs(path util.AbsolutePath) (string, error) {
	f, err := path.Open()
	if err != nil {
		return "", err
	}
	defer f.Close()
	return GetNotebookInputs(f)
}

func GetNotebookInputs(r io.Reader) (string, error) {
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
