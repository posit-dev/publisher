package api

import (
	"strings"

	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
)

// repoOptsFromPositron converts inbound Positron settings to renv.RepoOptions.
// Returns nil if no Positron R settings were provided.
func repoOptsFromPositron(ps *positronSettings) *renv.RepoOptions {
	if ps == nil || ps.R == nil {
		return nil
	}
	mode := strings.TrimSpace(ps.R.DefaultRepositories)
	ppm := strings.TrimSpace(ps.R.PackageManagerRepository)
	return &renv.RepoOptions{
		RDefaultRepositories:      mode,
		RPackageManagerRepository: ppm,
	}
}
