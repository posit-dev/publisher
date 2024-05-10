package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"

	"github.com/rstudio/connect-client/internal/util"
)

type Lockfile struct {
	R        R                       `toml:"r" json:"r"`
	Packages map[PackageName]Package `toml:"packages" json:"packages"`
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
	RemoteType        string        `toml:"remote_type,omitempty" json:"remoteType"`
	RemotePkgRef      string        `toml:"remote_pkg_ref,omitempty" json:"remotePkgRef"`
	RemoteRef         string        `toml:"remote_ref,omitempty" json:"remoteRef"`
	RemoteRepos       string        `toml:"remote_repos,omitempty" json:"remoteRepos"`
	RemoteReposName   string        `toml:"remote_repos_name,omitempty" json:"remoteReposName"`
	RemotePkgPlatform string        `toml:"remote_pkg_platform,omitempty" json:"remotePkgPlatform"`
	RemoteSha         string        `toml:"remote_sha,omitempty" json:"remoteSha"`
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
