package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/inspect/dependencies/pydeps"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/interpreters"
)

func (p *defaultPublisher) configureInterpreters() error {
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
		lockfile, err := renv.ReadLockfile(p.Dir.Join(filename))
		if err != nil {
			return err
		}
		p.log.Debug("Renv lockfile in use", "lockfile", lockfile)
		p.Target.Renv = lockfile
	}

	return nil
}
