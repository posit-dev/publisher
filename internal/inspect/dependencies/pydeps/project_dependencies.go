package pydeps

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"regexp"
	"slices"
	"strings"

	"github.com/posit-dev/publisher/internal/util"
)

func ReadRequirementsFile(path util.AbsolutePath) ([]string, error) {
	content, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(content), "\n")
	commentRE := regexp.MustCompile(`^\s*(#.*)?$`)
	lines = slices.DeleteFunc(lines, func(line string) bool {
		return commentRE.MatchString(line)
	})
	return lines, nil
}
