package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	toml "github.com/pelletier/go-toml/v2"

	"github.com/posit-dev/publisher/internal/util"
)

// ReadPyProjectDependencies reads [project].dependencies from pyproject.toml.
// If optionalGroups is non-empty, also includes entries from
// [project.optional-dependencies] for the named groups.
//
// Returns nil with no error if the file doesn't exist, can't be parsed,
// or doesn't have a [project].dependencies section.
func ReadPyProjectDependencies(base util.AbsolutePath, optionalGroups []string) ([]string, error) {
	path := base.Join("pyproject.toml")
	exists, err := path.Exists()
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}

	data, err := path.ReadFile()
	if err != nil {
		return nil, err
	}

	var tomlData map[string]any
	if err := toml.Unmarshal(data, &tomlData); err != nil {
		return nil, nil // treat parse errors as "no data"
	}

	project, ok := tomlData["project"].(map[string]any)
	if !ok {
		return nil, nil
	}

	depsRaw, ok := project["dependencies"]
	if !ok {
		return nil, nil
	}

	depsSlice, ok := depsRaw.([]any)
	if !ok {
		return nil, nil
	}

	result := make([]string, 0, len(depsSlice))
	for _, d := range depsSlice {
		if s, ok := d.(string); ok {
			result = append(result, s)
		}
	}

	// Include optional dependency groups if requested
	if len(optionalGroups) > 0 {
		optDeps, ok := project["optional-dependencies"].(map[string]any)
		if ok {
			for _, group := range optionalGroups {
				groupDeps, ok := optDeps[group].([]any)
				if !ok {
					continue
				}
				for _, d := range groupDeps {
					if s, ok := d.(string); ok {
						result = append(result, s)
					}
				}
			}
		}
	}

	return result, nil
}

// HasPyProjectDependencies checks whether pyproject.toml exists and has a
// [project].dependencies section. This is a lightweight check that avoids
// parsing the full dependency list.
func HasPyProjectDependencies(base util.AbsolutePath) (bool, error) {
	path := base.Join("pyproject.toml")
	exists, err := path.Exists()
	if err != nil {
		return false, err
	}
	if !exists {
		return false, nil
	}

	data, err := path.ReadFile()
	if err != nil {
		return false, err
	}

	var tomlData map[string]any
	if err := toml.Unmarshal(data, &tomlData); err != nil {
		return false, nil
	}

	project, ok := tomlData["project"].(map[string]any)
	if !ok {
		return false, nil
	}

	_, ok = project["dependencies"]
	return ok, nil
}

