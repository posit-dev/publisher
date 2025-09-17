package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/bundles"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
	"github.com/posit-dev/publisher/internal/logging"
)

func (p *defaultPublisher) createManifest() (*bundles.Manifest, error) {
	manifest := bundles.NewManifestFromConfig(p.Config)
	p.log.Debug("Built manifest from config", "config", p.ConfigName)

	if p.Config.R != nil {
		scanDependencies := false

		// Prefer a configured package file when present; otherwise
		// use the interpreter's discovery (which falls back to renv.lock).
		if p.Config.R.PackageFile != "" {
			lockExists, err := p.Dir.Join(p.Config.R.PackageFile).Exists()
			scanDependencies = (err != nil) || !lockExists
			if err != nil {
				p.log.Debug("Error checking existence of configured R lockfile", "lockfile", p.Config.R.PackageFile, "error", err)
			}
		} else {
			scanDependencies = true
		}

		if scanDependencies {
			// Displays a log message under the package collection activity
			// so that the user knows we automatically detected dependencies
			// and which default repository is being used.
			log := p.log.WithArgs(logging.LogKeyOp, events.PublishGetRPackageDescriptionsOp)
			repoURL := renv.RepoURLFromOptions(p.RepoOptions)
			repoText := repoURL
			if repoText == "" {
				repoText = "none"
			}
			log.Info(fmt.Sprintf("No renv.lock found; automatically scanning for dependencies. Default repo: %s", repoText))
		}

		rPackages, lockfilePath, err := p.getRPackagesWithPath(scanDependencies)
		if err != nil {
			return nil, err
		}
		manifest.Packages = rPackages
		// Record the dependency source path (absolute or relative) so bundling
		// can ensure it is included regardless of configured file patterns.
		if lockfilePath.String() != "" {
			manifest.DependenciesSource = lockfilePath.Path
		}
	}

	p.log.Debug("Generated manifest:", manifest)
	return manifest, nil
}
