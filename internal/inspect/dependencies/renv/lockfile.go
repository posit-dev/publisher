package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"

	"github.com/posit-dev/publisher/internal/util"
)

type Bioconductor struct {
	Version string `toml:"version" json:"version"`
}

type Lockfile struct {
	R R `toml:"r" json:"r"`
	// Exclude Bioconductor from deployment TOML; keep JSON for renv.lock parsing
	Bioconductor Bioconductor            `toml:"-" json:"Bioconductor"`
	Packages     map[PackageName]Package `toml:"packages" json:"packages"`
}

type R struct {
	Version      string       `toml:"version" json:"version"`
	Repositories []Repository `toml:"repositories" json:"repositories"`
}

type Repository struct {
	Name string  `toml:"name" json:"name"`
	URL  RepoURL `toml:"url" json:"url"`
}

type PackageName string
type RepoURL string

type Package struct {
	Package           PackageName   `toml:"package" json:"package"`
	Version           string        `toml:"version" json:"version"`
	Source            string        `toml:"source" json:"source"`
	Repository        RepoURL       `toml:"repository" json:"repository"`
	Requirements      []PackageName `toml:"requirements,omitempty" json:"requirements"`
	Hash              string        `toml:"hash" json:"hash"`
	RemoteType        string        `toml:"remote_type,omitempty" json:"remoteType,omitempty"`
	RemotePkgRef      string        `toml:"remote_pkg_ref,omitempty" json:"remotePkgRef,omitempty"`
	RemoteRef         string        `toml:"remote_ref,omitempty" json:"remoteRef,omitempty"`
	RemoteRepos       string        `toml:"remote_repos,omitempty" json:"remoteRepos,omitempty"`
	RemoteReposName   string        `toml:"remote_repos_name,omitempty" json:"remoteReposName,omitempty"`
	RemotePkgPlatform string        `toml:"remote_pkg_platform,omitempty" json:"remotePkgPlatform,omitempty"`
	RemoteSha         string        `toml:"remote_sha,omitempty" json:"remoteSha,omitempty"`

	// Additional fields from renv.lock that we want to copy to the manifest
	Type               string   `toml:"type,omitempty" json:"Type,omitempty"`
	Title              string   `toml:"title,omitempty" json:"Title,omitempty"`
	AuthorsAtR         string   `toml:"authors@r,omitempty" json:"Authors@R,omitempty"`
	Maintainer         string   `toml:"maintainer,omitempty" json:"Maintainer,omitempty"`
	Description        string   `toml:"description,omitempty" json:"Description,omitempty"`
	URL                string   `toml:"url,omitempty" json:"URL,omitempty"`
	BugReports         string   `toml:"bugreports,omitempty" json:"BugReports,omitempty"`
	License            string   `toml:"license,omitempty" json:"License,omitempty"`
	Imports            []string `toml:"imports,omitempty" json:"Imports,omitempty"`
	Suggests           []string `toml:"suggests,omitempty" json:"Suggests,omitempty"`
	VignetteBuilder    string   `toml:"vignettebuilder,omitempty" json:"VignetteBuilder,omitempty"`
	RoxygenNote        string   `toml:"roxygennote,omitempty" json:"RoxygenNote,omitempty"`
	Encoding           string   `toml:"encoding,omitempty" json:"Encoding,omitempty"`
	NeedsCompilation   string   `toml:"needscompilation,omitempty" json:"NeedsCompilation,omitempty"`
	Author             string   `toml:"author,omitempty" json:"Author,omitempty"`
	ConfigTesthat      string   `toml:"config/testthat/edition,omitempty" json:"Config/testthat/edition,omitempty"`
	ConfigNeeds        string   `toml:"config/needs/website,omitempty" json:"Config/Needs/website,omitempty"`
	SystemRequirements string   `toml:"systemrequirements,omitempty" json:"SystemRequirements,omitempty"`
}

func ReadLockfile(path util.AbsolutePath) (*Lockfile, error) {
	contents, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	var lockfile Lockfile
	err = json.Unmarshal(contents, &lockfile)
	if err != nil {
		return nil, err
	}
	return &lockfile, nil
}

// ValidateModernLockfile enforces requirements for renv >= 1.1.0 lockfiles.
// We require modern lockfiles because they provide resolvable repository URLs
// in the top-level Repositories section, enabling consistent package deployment
// across different environments without relying on local R configuration.
func ValidateModernLockfile(lockfile *Lockfile) error {
	if len(lockfile.R.Repositories) == 0 {
		return fmt.Errorf("renv.lock is not compatible, missing Repositories section. Regenerate the lockfile with renv >= 1.1.0")
	}
	return nil
}

// isURL detects URLs to distinguish between repository names and repository URLs in renv.lock.
// This distinction is critical because the defaultPackageMapper (legacy approach using installed R libraries)
// and LockfilePackageMapper (lockfile-only approach) must produce identical output formats regardless
// of whether packages reference repositories by name ("CRAN") or URL ("https://cloud.r-project.org").
func isURL(s string) bool {
	return len(s) > 0 && (s[0:4] == "http" || s[0:3] == "ftp") && contains(s, "://")
}

// contains provides substring search without importing strings package.
// We avoid the strings import here to keep lockfile parsing dependencies minimal.
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Example package installed from CRAN
// "rlang": {
// 	"Package": "rlang",
// 	"Version": "1.1.1",
// 	"Source": "Repository",
// 	"Repository": "CRAN",
// 	"Hash": "a85c767b55f0bf9b7ad16c6d7baee5bb",
// 	"Requirements": []
// },

// Example package installed from GitHub with devtools::install_github
// "rmarkdown": {
// 	"Package": "rmarkdown",
// 	"Version": "2.26.1",
// 	"Source": "GitHub",
// 	"RemoteType": "github",
// 	"RemoteHost": "api.github.com",
// 	"RemoteRepo": "rmarkdown",
// 	"RemoteUsername": "rstudio",
// 	"RemoteRef": "HEAD",
// 	"RemoteSha": "d0088950258f3835a9de9bafa0cb470e4040e3a9",
// 	"Hash": "5bea622e12ba7186f6e0e3a54983cc70",
// 	"Requirements": [
// 	  "bslib",
// 	  "evaluate",
// 	  "fontawesome",
// 	  "htmltools",
// 	  "jquerylib",
// 	  "jsonlite",
// 	  "knitr",
// 	  "tinytex",
// 	  "xfun",
// 	  "yaml"
// 	]
// },
