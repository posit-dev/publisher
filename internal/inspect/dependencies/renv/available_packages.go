package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/rstudio/connect-client/internal/executor"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/util"
)

type AvailablePackage struct {
	Name       PackageName
	Version    string
	Repository string
}

type AvailablePackagesLister interface {
	ListAvailablePackages(repos []Repository) ([]AvailablePackage, error)
	GetBioconductorRepos(base util.AbsolutePath) ([]Repository, error)
	GetLibPaths() ([]util.AbsolutePath, error)
}

type defaultAvailablePackagesLister struct {
	base        util.AbsolutePath
	rExecutable util.Path
	rExecutor   executor.Executor
	log         logging.Logger
}

func NewAvailablePackageLister(base util.AbsolutePath, rExecutable util.Path, log logging.Logger) *defaultAvailablePackagesLister {
	if rExecutable.String() == "" {
		rExecutable = util.NewPath("R", nil)
	}
	return &defaultAvailablePackagesLister{
		base:        base,
		rExecutable: rExecutable,
		rExecutor:   executor.NewExecutor(),
		log:         log,
	}
}

const packageListCodeTemplate = `
(function() {
	pkgs <- available.packages(
	  repos = setNames(c(%s), c(%s)),
	  type = "source",
	  filters = c(
		getOption("rsconnect.available_packages_filters", default = c()),
		"duplicates"
	  )
	)
	info <- pkgs[,c("Package", "Version", "Repository")]
	apply(info, 1, function(x) { cat(x, sep=" ", collapse="\n") } )
	invisible()
  })()
`

func repoUrlsAsStrings(repos []Repository) string {
	quotedUrls := []string{}
	for _, repo := range repos {
		url := strings.TrimSuffix(string(repo.URL), "/")
		quotedUrls = append(quotedUrls, fmt.Sprintf("%q", url))
	}
	return strings.Join(quotedUrls, ", ")
}

func repoNamesAsStrings(repos []Repository) string {
	quotedNames := []string{}

	for i, repo := range repos {
		name := repo.Name
		if name == "" {
			// Ensure that each repository has a unique name
			// See rsconnect:::standardizeRepos.
			name = fmt.Sprintf("repo_%d", i)
		}
		quotedNames = append(quotedNames, fmt.Sprintf("%q", name))
	}
	return strings.Join(quotedNames, ", ")
}

func (l *defaultAvailablePackagesLister) ListAvailablePackages(repos []Repository) ([]AvailablePackage, error) {
	repoUrls := repoUrlsAsStrings(repos)
	repoNames := repoNamesAsStrings(repos)
	packageListCode := fmt.Sprintf(packageListCodeTemplate, repoUrls, repoNames)

	out, _, err := l.rExecutor.RunCommand(
		l.rExecutable.String(),
		[]string{
			"-s",
			"-e",
			packageListCode,
		},
		l.base,
		l.log)

	if err != nil {
		return nil, err
	}

	available := []AvailablePackage{}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		parts := strings.SplitN(line, " ", 3)
		if len(parts) != 3 {
			continue
		}
		packageName := parts[0]
		version := parts[1]
		repoUrl := strings.TrimSuffix(parts[2], "/src/contrib")
		available = append(available, AvailablePackage{
			Name:       PackageName(packageName),
			Version:    version,
			Repository: repoUrl,
		})
	}
	return available, nil
}

const bioconductorReposCodeTemplate = `
(function() {
	if (requireNamespace("BiocManager", quietly = TRUE) ||
		requireNamespace("BiocInstaller", quietly = TRUE)) {
		repos <- getFromNamespace("renv_bioconductor_repos", "renv")("%s")
		repos <- repos[setdiff(names(repos), "CRAN")]
		cat(repos, labels=names(repos), fill=1)
		invisible()
	}
})()
`

func (l *defaultAvailablePackagesLister) GetBioconductorRepos(base util.AbsolutePath) ([]Repository, error) {
	biocRepoListCode := fmt.Sprintf(bioconductorReposCodeTemplate, base)

	out, _, err := l.rExecutor.RunCommand(
		l.rExecutable.String(),
		[]string{
			"-s",
			"-e",
			biocRepoListCode,
		},
		l.base,
		l.log)

	if err != nil {
		return nil, err
	}

	repos := []Repository{}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line[0] == '-' {
			// e.g. "- The project is out-of-sync -- use `renv::status()` for details."
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) != 2 {
			continue
		}
		repos = append(repos, Repository{
			Name: parts[0],
			URL:  RepoURL(parts[1]),
		})
	}
	return repos, nil
}

func (l *defaultAvailablePackagesLister) GetLibPaths() ([]util.AbsolutePath, error) {
	const getLibPathsCode = `cat(.libPaths(), sep="\n")`
	out, _, err := l.rExecutor.RunCommand(
		l.rExecutable.String(),
		[]string{
			"-s",
			"-e",
			getLibPathsCode,
		},
		l.base,
		l.log)

	if err != nil {
		return nil, err
	}

	paths := []util.AbsolutePath{}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		paths = append(paths, util.NewAbsolutePath(line, nil))
	}
	return paths, nil
}
