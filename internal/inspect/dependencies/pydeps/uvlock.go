package pydeps

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"fmt"

	toml "github.com/pelletier/go-toml/v2"

	"github.com/posit-dev/publisher/internal/util"
)

// uvLockPackageSource represents the source field of a [[package]] entry.
type uvLockPackageSource struct {
	Editable string `toml:"editable"`
	Virtual  string `toml:"virtual"`
	Registry string `toml:"registry"`
}

// uvLockPackage represents a single [[package]] entry in uv.lock.
type uvLockPackage struct {
	Name    string              `toml:"name"`
	Version string              `toml:"version"`
	Source  uvLockPackageSource `toml:"source"`
}

// uvLockFile represents the top-level structure of a uv.lock file.
type uvLockFile struct {
	Version  int             `toml:"version"`
	Packages []uvLockPackage `toml:"package"`
}

// ReadUvLockDependencies reads all pinned dependencies from a uv.lock file.
// Returns the full transitive set as "name==version" strings, excluding the
// root project (identified by an editable or virtual source).
//
// Returns nil with no error if the file doesn't exist or can't be parsed.
func ReadUvLockDependencies(base util.AbsolutePath) ([]string, error) {
	path := base.Join("uv.lock")
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

	var lockfile uvLockFile
	if err := toml.Unmarshal(data, &lockfile); err != nil {
		return nil, nil // treat parse errors as "no data"
	}

	if len(lockfile.Packages) == 0 {
		return nil, nil
	}

	var result []string
	for _, pkg := range lockfile.Packages {
		// Skip the root project entry
		if pkg.Source.Editable != "" || pkg.Source.Virtual != "" {
			continue
		}
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

// HasUvLock checks whether a uv.lock file exists in the project directory.
func HasUvLock(base util.AbsolutePath) (bool, error) {
	path := base.Join("uv.lock")
	return path.Exists()
}
