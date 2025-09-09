package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/util"
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
		// Manifest should always provide the dependency source that was actually used
		// to construct the manifest (either the existing renv.lock or the auto-generated one).
		if manifest == nil || manifest.DependenciesSource.String() == "" {
			return fmt.Errorf("manifest missing DependenciesSource for R dependencies")
		}
		src := manifest.DependenciesSource.String()
		var lockfileAbs util.AbsolutePath
		if filepath.IsAbs(src) {
			lockfileAbs = util.NewAbsolutePath(src, manifest.DependenciesSource.Fs())
		} else {
			lockfileAbs = p.Dir.Join(src)
		}
		p.log.Debug("R configuration present", "lockfile", lockfileAbs.String())

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
