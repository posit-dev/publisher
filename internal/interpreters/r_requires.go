package interpreters

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/posit-dev/publisher/internal/util"
)

type RProjectRRequires struct {
	ProjectPath util.AbsolutePath
}

func NewRProjectRRequires(projectPath util.AbsolutePath) *RProjectRRequires {
	return &RProjectRRequires{
		ProjectPath: projectPath,
	}
}

// Find the R version requested by the project if specified in any of the
// supported metadata files. The order of precedence is:
// 1. DESCRIPTION file (i.e. Depends: R (>= 3.5.0)
// 2. renv.lock
//
// The version specifications are the one defined by PEP 440
// if no version is found, an error is returned.
func (p *RProjectRRequires) GetRVersionRequirement() (string, error) {
	if version, err := p.readDescriptionFile(); err == nil && version != "" {
		return version, nil
	}
	if version, err := p.readRenvLockl(); err == nil && version != "" {
		return version, nil
	}
	return "", errors.New("no R version requirement found")
}

// Read a DESCRIPTION file and look for the "Depends:" section.
// if the section contains an entry for R (IE: "R (>= 3.5.0)")
// return the requirement constraint.
func (p *RProjectRRequires) readDescriptionFile() (string, error) {
	path := p.ProjectPath.Join("DESCRIPTION")
	content, err := path.ReadFile()
	if err != nil {
		return "", err
	}

	lines := strings.Split(string(content), "\n")

	// Find the "Depends:" line and extract all the dependencies.
	var deps []string
	found := false
	for _, line := range lines {
		if strings.HasPrefix(line, "Depends:") {
			deps = append(deps, strings.TrimPrefix(line, "Depends:"))
			found = true
		} else if found && (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) {
			deps = append(deps, strings.TrimSpace(line))
		} else if found {
			break
		}
	}

	// Join the dependencies into a single string and look for R.
	// The regex will match "R (ANYTHING)"
	all := strings.Join(deps, " ")
	re := regexp.MustCompile(`\bR\s*\(([^)]+)\)`)
	match := re.FindStringSubmatch(all)
	if len(match) >= 2 {
		return match[1], nil
	}
	return "", nil
}

// Read a renv.lock file and return the version string.
// The file is a JSON file that contains a set of dependencies.
//
//	"R": {
//		 "Version": "4.2.2"
//	}, ...
func (p *RProjectRRequires) readRenvLockl() (string, error) {
	path := p.ProjectPath.Join("renv.lock")
	data, err := path.ReadFile()
	if err != nil {
		return "", err
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", err
	}

	if rSection, ok := parsed["R"].(map[string]any); ok {
		if version, ok := rSection["Version"].(string); ok {
			return "~=" + version, nil
		}
	}
	return "", nil
}
