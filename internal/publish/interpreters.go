package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/util"
	"path/filepath"
)

// addDependenciesToTarget reads dependency files and updates the Target
// deployment record for recordkeeping. For R, when a Manifest is provided,
// it prefers Manifest.DependenciesSource as the lockfile path.
func (p *defaultPublisher) addDependenciesToTarget(manifest *bundles.Manifest) error {
	if p.Config.Python != nil {
		filename := p.Config.Python.PackageFile
		if filename == "" {
			filename = interpreters.PythonRequirementsFilename
		}
		p.log.Debug("Python configuration present", "PythonRequirementsFile", filename)

		requirements, err := pydeps.ReadRequirementsFile(p.Dir.Join(filename))
		p.log.Debug("Python requirements file in use", "requirements", requirements)
		if err != nil {
			return err
		}
		p.Target.Requirements = requirements
	}

	if p.Config.R != nil {
		filename := p.Config.R.PackageFile
		if filename == "" {
			filename = interpreters.DefaultRenvLockfile
		}
		p.log.Debug("R configuration present", "filename", filename)

		// Resolve lockfile location. Prefer manifest dependency source when provided,
		// but fall back to configured/default lockfile if it doesn't exist.
		var lockfileAbs util.AbsolutePath
		var candidates []util.AbsolutePath
		if manifest != nil && manifest.DependenciesSource.String() != "" {
			src := manifest.DependenciesSource.String()
			if filepath.IsAbs(src) {
				candidates = append(candidates, util.NewAbsolutePath(src, manifest.DependenciesSource.Fs()))
			} else {
				candidates = append(candidates, p.Dir.Join(src))
			}
		}
		// Configured/default lockfile at project root
		candidates = append(candidates, p.Dir.Join(filename))
		// Staged lockfile (used when we scan and stage into .posit/publish)
		candidates = append(candidates, p.Dir.Join(".posit", "publish", interpreters.DefaultRenvLockfile))

		for _, c := range candidates {
			if ok, _ := c.Exists(); ok {
				lockfileAbs = c
				break
			}
		}
		if lockfileAbs.String() == "" {
			// None of the candidates exist; return an error from ReadLockfile
			lockfileAbs = candidates[0]
		}

		lockfile, err := renv.ReadLockfile(lockfileAbs)
		if err != nil {
			return err
		}
		// Enforce modern renv.lock format when publishing
		if err := renv.ValidateModernLockfile(lockfile); err != nil {
			return err
		}
		p.log.Debug("Renv lockfile in use", "lockfile", lockfile)
		p.Target.Renv = lockfile
	}

	return nil
}
