package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"
	"strings"

	"github.com/posit-dev/publisher/internal/util"
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

func DetectMarkdownLanguagesInContent(content []byte) (bool, bool) {
	// Find code chunks: blocks delimited by ```{language}...```
	// or inline code as `language...`
	// RE structure:
	//   (?m): ^ matches start of any line
	//   literal ```
	//   space or closing brace (accommodates {r} and {r echo=FALSE})
	//   alternatively, inline code block with single backtick and language
	rBlockRE := regexp.MustCompile("((?m)^```[{]r[ ,}])|(`r )")
	pyBlockRE := regexp.MustCompile("((?m)^```[{]python[ ,}])|(`python )")

	needsR := rBlockRE.Match(content)
	needsPython := pyBlockRE.Match(content)
	return needsR, needsPython
}

func DetectMarkdownLanguages(base util.AbsolutePath) (bool, bool, error) {
	needsR := false
	needsPython := false

	files, err := base.Glob("*.Rmd")
	if err != nil {
		return false, false, err
	}

	for _, path := range files {
		content, err := path.ReadFile()
		if err != nil {
			return false, false, err
		}
		fileNeedsR, fileNeedsPython := DetectMarkdownLanguagesInContent(content)
		needsR = needsR || fileNeedsR
		needsPython = needsPython || fileNeedsPython

		if needsR && needsPython {
			// No need to look further
			break
		}
	}
	return needsR, needsPython, nil
}
