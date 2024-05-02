package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"encoding/json"

	"github.com/rstudio/connect-client/internal/util"
)

type Lockfile struct {
	R        R
	Packages map[PackageName]Package
}

type R struct {
	Version      string
	Repositories []Repository
}

type Repository struct {
	Name string
	URL  RepoURL
}

type PackageName string
type RepoURL string

type Package struct {
	Package           PackageName
	Version           string
	Source            string
	Repository        RepoURL
	Requirements      []PackageName
	Hash              string
	RemoteType        string
	RemotePkgRef      string
	RemoteRef         string
	RemoteRepos       string
	RemoteReposName   string
	RemotePkgPlatform string
	RemoteSha         string
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
