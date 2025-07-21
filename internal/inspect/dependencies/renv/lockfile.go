package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"

	"github.com/posit-dev/publisher/internal/util"
)

type Lockfile struct {
	R        R                       `toml:"r" mapstructure:"r" json:"r"`
	Packages map[PackageName]Package `toml:"packages" mapstructure:"packages" json:"packages"`
}

type R struct {
	Version      string       `toml:"version" mapstructure:"version" json:"version"`
	Repositories []Repository `toml:"repositories" mapstructure:"repositories" json:"repositories"`
}

type Repository struct {
	Name string  `toml:"name" mapstructure:"name" json:"name"`
	URL  RepoURL `toml:"url" mapstructure:"url" json:"url"`
}

type PackageName string
type RepoURL string

type Package struct {
	Package           PackageName   `toml:"package" mapstructure:"package" json:"package"`
	Version           string        `toml:"version" mapstructure:"version" json:"version"`
	Source            string        `toml:"source" mapstructure:"source" json:"source"`
	Repository        RepoURL       `toml:"repository" mapstructure:"repository" json:"repository"`
	Requirements      []PackageName `toml:"requirements,omitempty" mapstructure:"requirements,omitempty" json:"requirements"`
	Hash              string        `toml:"hash" mapstructure:"hash" json:"hash"`
	RemoteType        string        `toml:"remote_type,omitempty" mapstructure:"remote_type,omitempty" json:"remoteType,omitempty"`
	RemotePkgRef      string        `toml:"remote_pkg_ref,omitempty" mapstructure:"remote_pkg_ref,omitempty" json:"remotePkgRef,omitempty"`
	RemoteRef         string        `toml:"remote_ref,omitempty" mapstructure:"remote_ref,omitempty" json:"remoteRef,omitempty"`
	RemoteRepos       string        `toml:"remote_repos,omitempty" mapstructure:"remote_repos,omitempty" json:"remoteRepos,omitempty"`
	RemoteReposName   string        `toml:"remote_repos_name,omitempty" mapstructure:"remote_repos_name,omitempty" json:"remoteReposName,omitempty"`
	RemotePkgPlatform string        `toml:"remote_pkg_platform,omitempty" mapstructure:"remote_pkg_platform,omitempty" json:"remotePkgPlatform,omitempty"`
	RemoteSha         string        `toml:"remote_sha,omitempty" mapstructure:"remote_sha,omitempty" json:"remoteSha,omitempty"`
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
