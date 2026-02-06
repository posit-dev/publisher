package renv

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/posit-dev/publisher/internal/executor"
	"github.com/posit-dev/publisher/internal/interpreters"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

// RDependencyScanner generates a temporary renv.lock by invoking R
// and returns the absolute path to that lockfile.
// Inspired by the Python DependencyScanner, but R/renv specific.
type RDependencyScanner interface {
	// ScanDependencies creates a temp directory and uses renv::dependencies +
	// renv::snapshot() to produce a lockfile, returning its absolute path.
	ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error)

	// SetupRenvInDir sets up renv in the specified directory with the given lockfile name
	// and R executable path, returning the absolute path to the created lockfile.
	SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error)
}

type defaultRDependencyScanner struct {
	rExecutor executor.Executor
	log       logging.Logger
	repoOpts  *RepoOptions
}

// NewRDependencyScanner creates a dependency scanner. If repoOpts is non-nil,
// the scanner configures R repositories accordingly.
func NewRDependencyScanner(log logging.Logger, repoOpts *RepoOptions) *defaultRDependencyScanner {
	return &defaultRDependencyScanner{
		rExecutor: executor.NewExecutor(),
		log:       log,
		repoOpts:  repoOpts,
	}
}

func (s *defaultRDependencyScanner) ScanDependencies(paths []string, rExecutable string) (util.AbsolutePath, error) {
	if len(paths) == 0 {
		return util.AbsolutePath{}, fmt.Errorf("no paths to scan dependencies of")
	}

	// Create a temp directory in the system temp location (not under the project)
	tmpRoot := util.NewPath("", nil)
	tmpProjectPath, err := tmpRoot.TempDir("publisher-renv-")
	if err != nil {
		return util.AbsolutePath{}, err
	}

	return s.ScanDependenciesInDir(paths, tmpProjectPath, "", rExecutable)
}

func (i *defaultRDependencyScanner) SetupRenvInDir(targetPath string, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	pathSlice := []string{targetPath}

	return i.ScanDependenciesInDir(pathSlice, util.NewPath(targetPath, nil), lockfile, rExecutable)
}

// ScanDependenciesInDir uses renv to scan the provided paths and create set up
func (s *defaultRDependencyScanner) ScanDependenciesInDir(paths []string, targetDir util.Path, lockfile string, rExecutable string) (util.AbsolutePath, error) {
	// Build R script: ensure non-interactive renv, detect deps from the base project (working dir),
	// regardless of the destination targetPath for the lockfile.
	// initialize a temporary renv project in tmpDir, install deps into it, then snapshot its lockfile.
	normalizedProjectPath := filepath.ToSlash(targetDir.String()) // Use forward-slash for compatibility across platforms.
	rPathsVec, err := s.toRPathsVector(paths)
	if err != nil {
		return util.AbsolutePath{}, err
	}
	if lockfile == "" {
		lockfile = interpreters.DefaultRenvLockfile
	}
	lockfile = filepath.ToSlash(lockfile) // Lockfile may in fact contain slashes.
	// Compute repository URL once; the R code will apply it via options(repos=...).
	repoURL := RepoURLFromOptions(s.repoOpts)

	script := fmt.Sprintf(`(function(){
	options(renv.consent = TRUE)
	repoUrl <- "%s"
	if (nzchar(repoUrl)) options(repos = c(CRAN = repoUrl))
	rPathsVec <- %s
	deps <- character()
	for (path in rPathsVec) {
		tryCatch({
			d <- renv::dependencies(path = path, progress = FALSE)
			deps <- c(deps, d$Package[!is.na(d$Package)])
		}, error = function(e) {
			# Silently skip paths that cause errors (e.g., non-existent files, directories)
			invisible()
		})
	}
	deps <- setdiff(deps, c("renv"))
	targetPath <- "%s"
	try(renv::init(project = targetPath, bare = TRUE, force = TRUE), silent = TRUE)
	try(renv::install(deps, project = targetPath), silent = TRUE)
	lockfile <- file.path(targetPath, "%s")
	renv::snapshot(project = targetPath, lockfile = lockfile, prompt = FALSE, type = "all")
	invisible()
})()`, repoURL, rPathsVec, normalizedProjectPath, lockfile)

	// Run the script (use the temporary project as the working directory)
	// Ensure working directory is provided as an AbsolutePath
	absTarget := util.NewAbsolutePath(targetDir.String(), nil)
	stdout, stderr, err := s.rExecutor.RunScript(rExecutable, []string{"-s"}, script, absTarget, s.log)
	s.log.Debug("RDependencyScanner renv scan", "stdout", string(stdout), "stderr", string(stderr))
	if err != nil {
		return util.AbsolutePath{}, err
	}

	// Ensure the lockfile was created
	lockfilePath := targetDir.Join(lockfile)
	exists, err := lockfilePath.Exists()
	if err != nil {
		return util.AbsolutePath{}, err
	}
	if !exists {
		return util.AbsolutePath{}, fmt.Errorf("renv could not create lockfile: %s", lockfilePath.String())
	}
	return util.NewAbsolutePath(lockfilePath.String(), nil), nil
}

// toRPathsVector converts a slice of filesystem paths/globs into an R c("a", "b") vector string.
// It validates each path to avoid unsafe characters for direct injection into an R string literal
// without escaping. We intentionally do not escape uncommon characters; instead we reject unsafe inputs.
func (s *defaultRDependencyScanner) toRPathsVector(paths []string) (string, error) {
	if len(paths) == 0 {
		return "c()", nil
	}

	quoted := make([]string, 0, len(paths))
	for _, p := range paths {
		// Normalize separators to forward slashes for cross-system compatibility.
		norm := filepath.ToSlash(p)
		// Validate for unsafe characters that could break the R string literal when unescaped
		if strings.ContainsRune(norm, '"') || strings.ContainsRune(norm, '\n') || strings.ContainsRune(norm, '\r') {
			return "", fmt.Errorf("path contains invalid characters: %q", p)
		}
		quoted = append(quoted, "\""+norm+"\"")
	}
	return "c(" + strings.Join(quoted, ", ") + ")", nil
}

// RepoOptions defines how to set R repositories during dependency scanning.
// Values mirror VS Code setting `positron.r.defaultRepositories`.
type RepoOptions struct {
	// RDefaultRepositories selects which R repository set to prefer.
	// One of: "auto", "rstudio", "posit-ppm", "none", or a full http(s) URL.
	RDefaultRepositories string
	// RPackageManagerRepository is an optional custom PPM base URL, used when RDefaultRepositories == "auto".
	RPackageManagerRepository string
}

func repoURLFrom(mode, ppm string) string {
	switch mode {
	case "auto":
		if ppm != "" {
			return strings.TrimRight(ppm, "/")
		}
		return "https://cloud.r-project.org"
	case "posit-ppm":
		return "https://packagemanager.posit.co/cran/latest"
	case "rstudio":
		return "https://cran.rstudio.com"
	case "none":
		return ""
	default:
		if strings.HasPrefix(mode, "http://") || strings.HasPrefix(mode, "https://") {
			return strings.TrimRight(mode, "/")
		}
		return ""
	}
}

func RepoURLFromOptions(opts *RepoOptions) string {
	if opts == nil {
		// Unconfigured defaults to CRAN via "auto" mode
		return repoURLFrom("auto", "")
	}
	mode := strings.ToLower(strings.TrimSpace(opts.RDefaultRepositories))
	if mode == "" {
		mode = "auto"
	}
	return repoURLFrom(mode, strings.TrimSpace(opts.RPackageManagerRepository))
}
