package renv

// Copyright (C) 2024 by Posit Software, PBC.

import (
	"fmt"
	"strings"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

type AvailablePackage struct {
	Name       PackageName
	Version    string
	Repository string
}

type AvailablePackagesLister interface {
	ListAvailablePackages(repos []Repository, log logging.Logger) ([]AvailablePackage, error)
	GetBioconductorRepos(base util.AbsolutePath, log logging.Logger) ([]Repository, error)
	GetLibPaths(log logging.Logger) ([]util.AbsolutePath, error)
}

type defaultAvailablePackagesLister struct {
	base         util.AbsolutePath
	rInterpreter interpreters.RInterpreter
	rExecutor    executor.Executor
}

func NewAvailablePackageLister(base util.AbsolutePath, rExecutable util.Path, log logging.Logger, rInterpreterFactoryOverride interpreters.RInterpreterFactory, cmdExecutorOverride executor.Executor) (*defaultAvailablePackagesLister, error) {

	var rInterpreter interpreters.RInterpreter
	var err error

	if rInterpreterFactoryOverride != nil {
		rInterpreter, err = rInterpreterFactoryOverride(base, rExecutable, log, cmdExecutorOverride, nil, nil)
	} else {
		rInterpreter, err = interpreters.NewRInterpreter(base, rExecutable, log, nil, nil, nil)
	}

	return &defaultAvailablePackagesLister{
		base:         base,
		rInterpreter: rInterpreter,
		rExecutor:    executor.NewExecutor(),
	}, err
}

func repoUrlsAsStrings(repos []Repository) string {
	quotedUrls := []string{}
	for _, repo := range repos {
		url := strings.TrimSuffix(string(repo.URL), "/")
		quotedUrls = append(quotedUrls, fmt.Sprintf(`"%s"`, url))
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
		quotedNames = append(quotedNames, fmt.Sprintf(`"%s"`, name))
	}
	return strings.Join(quotedNames, ", ")
}

func (l *defaultAvailablePackagesLister) ListAvailablePackages(repos []Repository, log logging.Logger) ([]AvailablePackage, error) {
	// List package repos by writing a temp script, calling it, then cleaning it up
	const packageListCodeTemplate = `(function() { pkgs <- available.packages( repos = setNames(c(%s), c(%s)), type = "source", filters = c(getOption("rsconnect.available_packages_filters", default = c()), "duplicates"));info <- pkgs[,c("Package", "Version", "Repository")];apply(info, 1, function(x) { cat(x, sep=" ", collapse="\n") } );invisible()})()`
	repoUrls := repoUrlsAsStrings(repos)
	repoNames := repoNamesAsStrings(repos)
	packageListCode := fmt.Sprintf(packageListCodeTemplate, repoUrls, repoNames)

	rExecutable, err := l.rInterpreter.GetRExecutable()
	if err != nil {
		return nil, err
	}

	out, _, err := l.rExecutor.RunScript(
		rExecutable.String(),
		[]string{
			"-s",
		},
		packageListCode,
		l.base,
		log)

	if err != nil {
		return nil, err
	}

	available := []AvailablePackage{}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
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

func (l *defaultAvailablePackagesLister) GetBioconductorRepos(base util.AbsolutePath, log logging.Logger) ([]Repository, error) {
	// List bioc repos by writing a temp script, calling it, then cleaning it up
	const bioconductorReposCodeTemplate = `(function() { if (requireNamespace("BiocManager", quietly = TRUE) || requireNamespace("BiocInstaller", quietly = TRUE)) {repos <- getFromNamespace("renv_bioconductor_repos", "renv")("%s"); repos <- repos[setdiff(names(repos), "CRAN")]; cat(repos, labels=names(repos), fill=1); invisible()}})()`
	escapedBase := strings.ReplaceAll(l.base.String(), `\`, `\\`)
	biocRepoListCode := fmt.Sprintf(bioconductorReposCodeTemplate, escapedBase)

	rExecutable, err := l.rInterpreter.GetRExecutable()
	if err != nil {
		return nil, err
	}

	out, _, err := l.rExecutor.RunScript(
		rExecutable.String(),
		[]string{
			"-s",
		},
		biocRepoListCode,
		l.base,
		log)

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

func (l *defaultAvailablePackagesLister) GetLibPaths(log logging.Logger) ([]util.AbsolutePath, error) {

	rExecutable, err := l.rInterpreter.GetRExecutable()
	if err != nil {
		return nil, err
	}

	// Gather lib paths, by writing a temp script, calling it, then cleaning it up
	const getLibPathsCode = `cat(.libPaths(), sep="\n")`
	out, _, err := l.rExecutor.RunScript(
		rExecutable.String(),
		[]string{
			"-s",
		},
		getLibPathsCode,
		l.base,
		log)

	if err != nil {
		return nil, err
	}

	paths := []util.AbsolutePath{}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		paths = append(paths, util.NewAbsolutePath(line, nil))
	}
	return paths, nil
}
