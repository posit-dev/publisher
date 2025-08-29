package publish

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"github.com/posit-dev/publisher/internal/bundles"
)

func (p *defaultPublisher) createManifest() (*bundles.Manifest, error) {
	manifest := bundles.NewManifestFromConfig(p.Config)
	p.log.Debug("Built manifest from config", "config", p.ConfigName)

	if p.Config.R != nil {
		rPackages, err := p.getRPackages(false)
		if err != nil {
			return nil, err
		}
		manifest.Packages = rPackages
	}
	p.log.Debug("Generated manifest:", manifest)

	return manifest, nil
}
