package api

import (
	"strings"

	"github.com/posit-dev/publisher/internal/inspect/dependencies/renv"
)

// positronSettings represents the inbound VS Code settings payload for Positron.
type positronSettings struct {
	R *positronRSettings `json:"r,omitempty"`
}

type positronRSettings struct {
	DefaultRepositories      string `json:"defaultRepositories"`
	PackageManagerRepository string `json:"packageManagerRepository,omitempty"`
}

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
