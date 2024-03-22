package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"strings"

	"github.com/rstudio/connect-client/internal/util"
)

func GetQuartoFilePythonCode(path util.AbsolutePath) (string, error) {
	content, err := path.ReadFile()
	if err != nil {
		return "", err
	}
	return GetQuartoPythonCode(string(content)), nil
}

func GetQuartoPythonCode(content string) string {
	lines := strings.Split(content, "\n")
	inCodeBlock := false
	var codeLines []string

	for _, line := range lines {
		if inCodeBlock {
			if strings.HasPrefix(line, "```") {
				inCodeBlock = false
				codeLines = append(codeLines, "")
			} else {
				codeLines = append(codeLines, strings.TrimRight(line, "\r"))
			}
		} else if strings.HasPrefix(line, "```{python") {
			inCodeBlock = true
		}
	}
	return strings.Join(codeLines, "\n")
}
