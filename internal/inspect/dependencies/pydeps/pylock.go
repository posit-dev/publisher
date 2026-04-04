package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"fmt"

	toml "github.com/pelletier/go-toml/v2"

	"github.com/posit-dev/publisher/internal/util"
)

// pylockPackage represents a single [[packages]] entry in pylock.toml.
type pylockPackage struct {
	Name    string `toml:"name"`
	Version string `toml:"version"`
}

// pylockFile represents the top-level structure of a pylock.toml file.
type pylockFile struct {
	LockVersion string           `toml:"lock-version"`
	Packages    []pylockPackage  `toml:"packages"`
}

// ReadPyLockDependencies reads all pinned dependencies from a pylock.toml file
// (PEP 751 format). Returns the full dependency set as "name==version" strings.
//
// Returns nil with no error if the file doesn't exist or can't be parsed.
func ReadPyLockDependencies(base util.AbsolutePath) ([]string, error) {
	path := base.Join("pylock.toml")
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

	var lockfile pylockFile
	if err := toml.Unmarshal(data, &lockfile); err != nil {
		return nil, nil // treat parse errors as "no data"
	}

	if len(lockfile.Packages) == 0 {
		return nil, nil
	}

	var result []string
	for _, pkg := range lockfile.Packages {
		if pkg.Name == "" || pkg.Version == "" {
			continue
		}
		result = append(result, fmt.Sprintf("%s==%s", pkg.Name, pkg.Version))
	}

	if len(result) == 0 {
		return nil, nil
	}
	return result, nil
}

// HasPyLock checks whether a pylock.toml file exists in the project directory.
func HasPyLock(base util.AbsolutePath) (bool, error) {
	path := base.Join("pylock.toml")
	return path.Exists()
}
